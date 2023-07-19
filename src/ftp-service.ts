import * as core from '@actions/core';
import * as fs from 'fs';
import Client from 'ftp';
import {basename, dirname, join} from 'path';
import {isBlank, isNotBlank} from './io-helper';

declare type Command = (service: FtpService) => Promise<any>;

export function execute<T>(handler: (callback: (error: Error | null, result?: T | undefined) => void) => void): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        handler((error, result) => {
            if (error)
                reject(error);
            else
                resolve(result);
        });
    });
}

export class FtpService {
    constructor(private client: Client) {
    }

    _firstString(...args: Array<any>): string | undefined {
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (typeof arg === 'string') {
                return arg;
            }
        }
    }

    _toArgv(command: string): string[] {
        const regexp = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi;
        const value = command;
        const result: string[] = [];
        let match: RegExpExecArray | null;
        do {
            match = regexp.exec(value);
            if (match !== null) {
                result.push(this._firstString(match[1], match[6], match[0])!);
            }
        } while (match !== null);
        return result;
    }

    async run(commands: string[], throwing: boolean = true): Promise<any> {
        const executable: Command[] = commands.map(command => {
            const args = this._toArgv(command);
            if (args.length > 0) {
                switch (args[0]) {
                    case 'ls':
                        if (args.length === 1)
                            return (service) => service.list();
                        break;
                    case 'get':
                        if (args.length < 4)
                            return (service) => service.get(args[1], args[2]);
                        break;
                    case 'put':
                        if (args.length < 4)
                            return (service) => service.put(args[1], args[2]);
                        break;
                    case 'append':
                        if (args.length < 4)
                            return (service) => service.append(args[1], args[2]);
                        break;
                    case 'rename':
                        if (args.length === 3)
                            return (service) => service.rename(args[1], args[2]);
                        break;
                    case 'delete':
                        if (args.length === 2)
                            return (service) => service.delete(args[1]);
                        break;
                    case 'cd':
                        if (args.length === 2)
                            return (service) => service.cd(args[1]);
                        break;
                    case 'mkdir':
                        if (args.length === 2)
                            return (service) => service.mkdir(args[1]);
                        break;
                    case 'rmdir':
                        if (args.length === 2)
                            return (service) => service.mkdir(args[1]);
                        break;
                }
            }
            throw new Error(`Unsupported command "${command}"`);
        });
        core.info('Executing commands');
        let result = {
            succeed: 0,
            message: null
        };
        try {
            for (const command of executable) {
                await command(this);
                result.succeed++;
            }
        } catch (e: any) {
            if (throwing)
                throw e;
            result.message = e.message;
            core.warning(e.message);
        }
        return result;
    }

    async list() {
        return execute(callback => {
            core.info('Listing');
            this.client.list((error, listing) => {
                if (listing) {
                    for (const element of listing) {
                        core.info(JSON.stringify(element));
                    }
                }
                callback(error);
            });
        });
    }

    async get(path: string, dest?: string) {
        let br = 0, work = '.', next = '', over = '';
        if (dest != null) {
            if (dest.endsWith('/')) {
                work = dest.slice(0, dest.length - 1);
            } else {
                work = dirname(dest);
                over = basename(dest);
            }
        }
        const paths = path.split('/');
        if (paths.length > 0) {
            let w = paths;
            if (!path.endsWith('/')) {
                w = paths.slice(0, paths.length - 1);
                next = paths[paths.length - 1];
            }
            for (let i = 0, len = w.length; i < len; i++) {
                if (isBlank(w[i]) && i > 0 && i < len)
                    throw new Error(`Path ${path} is invalid.`);
                await execute(callback => this.client.cwd(w[i], callback));
                br++;
            }
        }
        const download = async (name: string, parent: string, override?: string) => {
            const elements: Client.ListingElement[] | undefined = await execute(this.client.list);
            if (elements != null) {
                const dirs: string[] = [];
                for (const element of elements) {
                    if (isBlank(name) || element.name === name) {
                        if (element?.type === 'd') {
                            dirs.push(element.name);
                        } else if (element?.type === '-') {
                            await execute(callback =>
                                this.client.get(element.name, (error, stream) => {
                                    if (stream != null) {
                                        let dest = isBlank(name) || isBlank(override) ? element.name : override!;
                                        dest = isBlank(parent) ? dest : `${parent}/${dest}`;
                                        stream.pipe(fs.createWriteStream(dest));
                                    }
                                    callback(error);
                                }));
                        }
                    }
                }
                if (isNotBlank(name) && dirs.length === 0)
                    throw new Error(`Directory or file ${name} does not exist.`)
                for (const dir of dirs) {
                    await execute(callback => this.client.cwd(dir, callback));
                    const directory = isBlank(parent) ? dir : `${parent}/${dir}`;
                    if (fs.existsSync(directory)) {
                        if (!fs.lstatSync(path).isDirectory())
                            throw new Error(`Path ${directory} is not a directory.`);
                    } else {
                        fs.mkdirSync(directory);
                    }
                    await download('', directory);
                    await execute(callback => this.client.cdup(callback));
                }
            }
        };
        await download(next, work, over);
        while (br > 0) {
            await execute(callback => this.client.cdup(callback));
            br--;
        }
    }

    private async _cd(path: string | string[]): Promise<number> {
        let back = 0;
        let paths: string[] = [];
        if (typeof path === 'string')
            paths = path!.split('/');
        else {
            if (path != null)
                paths = path;
            path = paths.join('/');
        }
        for (let i = 0, len = paths.length; i < len; i++) {
            const p = paths[i];
            if (isBlank(p) && i > 0 && i < len - 1)
                throw new Error(`Path ${path} is invalid.`);
            const elements: any[] = await execute(this.client.list) ?? [];
            const type = elements.find(value => value.name === p)?.type;
            if (type == null)
                await execute(callback => this.client.mkdir(p, callback));
            if (type == null || type === 'd')
                await execute(callback => this.client.cwd(p, callback));
            else
                throw new Error(`Path ${path} is not a directory.`);
            back++;
        }
        return back;
    }

    private async _put(append: boolean, path: string, dest?: string) {
        const isDir = fs.lstatSync(path).isDirectory();
        let br = 0, dir = '', work = '', next = '';
        if (isBlank(dest)) {
            dir = '';
        } else {
            if (dest?.endsWith('/')) {
                dir = dest?.slice(0, dest?.length - 1);
            } else {
                dir = dest!;
            }
        }
        if (isNotBlank(dir)) {
            if (isDir) {
                work = dir!;
                next = path.endsWith('/') || !dest?.endsWith('/') ? '' : basename(path);
            } else {
                if (dest?.endsWith('/')) {
                    work = dir!;
                    next = basename(path);
                } else {
                    work = dirname(dir!);
                    next = basename(dir!);
                }
            }
            await this._cd(work);
        } else {
            work = '';
            next = path.endsWith('/') ? '' : basename(path);
        }
        if (isDir) {
            const upload = async (name: string, parent: string, work: string) => {
                if (isNotBlank(name)) {
                    await execute(callback => this.client.mkdir(name, callback));
                    work = isNotBlank(work) ? work + '/' + name : name;
                    core.info(`Created directory /${work}`);
                    await execute(callback => this.client.cwd(name, callback));
                }
                const elements = fs.readdirSync(parent);
                for (const element of elements) {
                    const p = join(parent, element)
                    if (fs.lstatSync(p).isDirectory()) {
                        await upload(element, p, work);
                    } else {
                        await execute(callback => {
                            if (append)
                                this.client.append(p, element, callback);
                            else
                                this.client.put(p, element, callback);
                        });
                        core.info(`Transferred file ${p} to ${isNotBlank(work) ? work + '/' + element : element}`);
                    }
                }
                if (isNotBlank(name)) {
                    await execute(callback => this.client.cdup(callback));
                }
            };
            await upload(next, path, work);
        } else {
            if (isBlank(next)) {
                next = basename(path);
            }
            await execute(callback => {
                if (append)
                    this.client.append(path, next, callback);
                else
                    this.client.put(path, next, callback);
            });
            core.info(`Transferred file ${path} to ${isNotBlank(work) ? `${work}/${next}` : next}`);
        }
        while (br > 0) {
            await execute(callback => this.client.cdup(callback));
            br--;
        }
    }

    async put(path: string, dest?: string) {
        await this._put(false, path, dest);
    }

    async append(path: string, dest?: string) {
        await this._put(true, path, dest);
    }

    async rename(oldPath: string, newPath: string) {
        await execute(callback => this.client.rename(oldPath, newPath, callback));
        core.info(`Renamed ${oldPath} to ${newPath}`);
    }

    async delete(path: string) {
        await execute(callback => this.client.delete(path, callback));
        core.info(`Deleted ${path}`);
    }

    async cd(path: string) {
        const paths = path.split('/');
        for (const p of paths) {
            if (isBlank(p))
                break;
            if (p === '..')
                await execute(callback => this.client.cdup(callback));
            else
                await execute(callback => this.client.cwd(path, callback));
        }
        core.info(`Changed working directory to ${path}`);
    }

    async mkdir(path: string) {
        const paths = path.split('/');
        for (const p of paths) {
            if (isBlank(p))
                break;
            await execute(callback => this.client.mkdir(p, true, callback));
        }
        core.info(`Created directory to ${path}`);
    }

    async rmdir(path: string) {
        await execute(callback => this.client.rmdir(path, true, callback));
        core.info(`Removed directory to ${path}`);
    }
}
