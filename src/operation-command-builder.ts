import * as _ from 'lodash';

import { CommandGroupTypes } from './command-group-types';
import * as commandOptionNames from './command-option-names';
import { OperationCommandAction } from './operation-command-action';
import { OperationCommandHelp } from './operation-command-help';
import { OperationCommandInfo } from './operation-command-info';
import { OperationCommandValidator } from './operation-command-validator';
import { Options } from './options';
import { TextBuilder } from './text-builder';

export class OperationCommandBuilder {
  constructor(private swaggerClientPromise: Promise<any>) {}

  public build(vorpal, options: Options, commandInfo: OperationCommandInfo) {
    const commandString = buildCommandString(options, commandInfo);

    const command = vorpal.command(
      commandString,
      commandInfo.operation.summary
    );

    // add command alias if command is being grouped (to provide a shorter command string to invoke it with)
    if (
      (options.operations.groupBy || CommandGroupTypes.None) !==
      CommandGroupTypes.None
    ) {
      command.alias(_.kebabCase(commandInfo.operation.operationId));
    }

    // add option for writing response body to file if operation produces body content
    if (
      commandInfo.operation.produces &&
      commandInfo.operation.produces.length > 0
    ) {
      command.option('--to-file <path>', 'file path to write response body');
    }

    // add option for request content type (based on values in consumes array)
    if (
      commandInfo.operation.consumes &&
      commandInfo.operation.consumes.length > 0
    ) {
      command.option(
        '--' + commandOptionNames.REQUEST_CONTENT_TYPE + ' <mime-type>',
        'desired MIME type of request body',
        commandInfo.operation.consumes
      );
    }

    // add option for response content type (based on values in produces array)
    if (
      commandInfo.operation.produces &&
      commandInfo.operation.produces.length > 0
    ) {
      command.option(
        '--' + commandOptionNames.RESPONSE_CONTENT_TYPE + ' <mime-type>',
        'desired MIME type of response body',
        commandInfo.operation.produces
      );
    }

    // add option for each optional parameter,
    // for enum parameters, add an autocomplete for each possible value
    const optionalParameters = _.filter(commandInfo.operation.parameters, {
      required: false
    });
    for (const parameter of optionalParameters) {
      const optionString = '--' + parameter.name;
      const optionDescription = parameter.description;
      const optionAutocomplete = parameter.items
        ? parameter.items.enum || null
        : null;
      command.option(optionString, optionDescription, optionAutocomplete);
    }

    // help() does seem to support functions that return a promise, so the callback needs to be used
    // to return the help text to be displayed
    const help = new OperationCommandHelp(command, commandInfo);
    command.help((commandStr, cb) => {
      const helpText = help.build(commandStr);
      cb(helpText);
    });

    const validator = new OperationCommandValidator(commandInfo, vorpal);
    command.validate(args => validator.validate(args));

    command.action(args => {
      const action = new OperationCommandAction(
        this.swaggerClientPromise,
        commandInfo,
        vorpal.activeCommand
      );
      return action.run(args, options);
    });

    return command;
  }
}

function buildCommandString(
  options: Options,
  commandInfo: OperationCommandInfo
): string {
  let commandString = '';

  commandString += commandInfo.commandStringParts.join(' ');

  // append required parameters to command string
  const requiredParameters = _.filter(commandInfo.operation.parameters, {
    required: true
  });
  for (const parameter of requiredParameters) {
    commandString += ' <' + parameter.name + '>';
  }

  return commandString;
}
