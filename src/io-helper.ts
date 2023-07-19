import * as core from '@actions/core';
import Client from 'ftp';
import {Inputs, Outputs} from './constants';

export interface FtpInputs extends Client.Options {
    commands: string[];
}

export function isBlank(value: any): boolean {
    return value === null || value === undefined || (value.length !== undefined && value.length === 0);
}

export function isNotBlank(value: any): boolean {
    return value !== null && value !== undefined && (value.length === undefined || value.length > 0);
}

/**
 * Helper to get all the inputs for the action
 */
export function getInputs(): FtpInputs {
    const result: FtpInputs = {
        commands: []
    };

    result.host = core.getInput(Inputs.Host, {required: true});

    const port = core.getInput(Inputs.Port, {required: false});
    if (isNotBlank(port)) {
        result.port = parseInt(port, 10);
    }

    result.user = core.getInput(Inputs.User, {required: false});
    result.password = core.getInput(Inputs.Password, {required: false});

    const connTimeout = core.getInput(Inputs.ConnTimeout, {required: false});
    if (isNotBlank(connTimeout)) {
        result.connTimeout = parseInt(connTimeout, 10);
    }

    const pasvTimeout = core.getInput(Inputs.PasvTimeout, {required: false});
    if (isNotBlank(pasvTimeout)) {
        result.pasvTimeout = parseInt(pasvTimeout, 10);
    }

    const keepalive = core.getInput(Inputs.Keepalive, {required: false});
    if (isNotBlank(keepalive)) {
        result.keepalive = parseInt(keepalive, 10);
    }

    const commands = core.getInput(Inputs.Commands, {required: true});
    if (isNotBlank(commands)) {
        result.commands = commands
            .split(/\r?\n/)
            .map(name => name.trim())
            .filter(name => name.length > 0);
    }
    if (result.commands.length === 0) {
        throw new Error('The commands is required.')
    }

    const debug = core.getBooleanInput(Inputs.Debug, {required: false});
    if (debug) {
        result.debug = message => core.debug(message);
    }

    return result;
}

export function setOutputs(response: any, log?: boolean) {
    // Get the outputs for the created release from the response
    let message = '';
    for (const key in Outputs) {
        const field: string = (Outputs as any)[key];
        if (log)
            message += `\n  ${field}: ${JSON.stringify(response[field])}`;
        core.setOutput(field, response[field]);
    }

    if (log)
        core.info('Outputs:' + message);
}
