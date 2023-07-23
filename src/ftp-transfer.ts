import * as core from '@actions/core';
import Client from 'ftp';
import {execute, FtpService} from './ftp-service';
import {FtpInputs, getInputs, setOutputs} from './io-helper';

(async function run(): Promise<void> {
    try {
        const inputs: FtpInputs = getInputs();
        const client: Client = new Client();
        const service: FtpService | undefined = await execute(callback => {
            client.on('ready', () => {
                core.info('Connected to ftp server.');
                callback(null, new FtpService(client));
            });
            client.on('error', error => {
                if (error) callback(error);
            });
            client.connect(inputs);
        });
        if (service != null) {
            const result = await service.run(inputs.commands, inputs.throwing);
            setOutputs(result);
        }
        client.end();
    } catch (err: any) {
        core.setFailed(err.message);
    }
})();
