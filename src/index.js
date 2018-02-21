'use strict';

const path = require('path');
const fs = require('fs');
const assignin = require('lodash.assignin');
const cloneDeep = require('lodash.clonedeep');
const startCase = require('lodash.startcase');


const fnGetAtt = logicalId => ({ "Fn::GetAtt": [ logicalId, "Arn" ] });
const fnGetRef = logicalId => ({ Ref: logicalId });

const normalizeName = name => name && `${startCase(name).split(' ').join()}`;

const getNormalizedFunctionName = functionName =>
    normalizeName(functionName.replace(/[-_]/g, '');

const getLogGroupLogicalId = functionName =>
    `${getNormalizedFunctionName(functionName)}LogGroup`;


class Plugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('aws');
        this.slsResources = serverless.service.provider.compiledCloudFormationTemplate.Resources;

        this.hooks = {
            'before:deploy:createDeploymentArtifacts': this.beforeDeployCreateDeploymentArtifacts.bind(this),
            'deploy:compileEvents': this.deployCompileEvents.bind(this),
            'after:deploy:deploy': this.afterDeployDeploy.bind(this)
        };
    }

    getEnvFilePath() {
        return path.join(this.serverless.config.servicePath, 'sumologic-shipping-function');
    }

    beforeDeployCreateDeploymentArtifacts() {
        if (!!this.serverless.service.custom.shipLogs.arn) {
            //use existing specified handler ARN
            return;
        }

        this.serverless.cli.log('Adding Cloudwatch to Sumologic lambda function');
        let functionPath = this.getEnvFilePath();

        if (!fs.existsSync(functionPath)) {
            fs.mkdirSync(functionPath);
        }

        let templatePath = path.resolve(__dirname, '../sumologic-function/handler.template.js');

        let templateFile = fs.readFileSync(templatePath, 'utf-8');

        let collectorUrl = this.serverless.service.custom.shipLogs.collectorUrl;

        let handlerFunction = templateFile.replace('%collectorUrl%', collectorUrl);

        let customRole = this.serverless.service.custom.shipLogs.role;

        fs.writeFileSync(path.join(functionPath, 'handler.js'), handlerFunction);

        this.serverless.service.functions.sumologicShipping = {
            handler: 'sumologic-shipping-function/handler.handler',
            events: []
        };

        if (!!customRole) {
            this.serverless.service.functions.sumologicShipping.role = customRole
        }
    }

    deployCompileEvents() {
        this.serverless.cli.log('Generating subscription filters');
        let filterPattern = !!this.serverless.service.custom.shipLogs.filterPattern ? this.serverless.service.custom.shipLogs.filterPattern : "[timestamp=*Z, request_id=\"*-*\", event]";

        let destinationArn = null;
        if (!!this.serverless.service.custom.shipLogs.arn) {
            destinationArn = this.serverless.service.custom.shipLogs.arn;
        } else {
            destinationArn = fnGetAtt("SumologicShippingLambdaFunction");
        }

        const filterBaseStatement = {
            Type: "AWS::Logs::SubscriptionFilter",
            Properties: {
                DestinationArn: destinationArn,
                FilterPattern: filterPattern
            },
            DependsOn: []
        };

        Object.freeze(filterBaseStatement); // Make it immutable

        const principal = `logs.${this.serverless.service.provider.region}.amazonaws.com`;

        let cloudwatchLogsLambdaPermission = {
            Type: "AWS::Lambda::Permission",
            Properties: {
                FunctionName: destinationArn,
                Action: "lambda:InvokeFunction",
                Principal: principal,
                SourceAccount: fnGetRef("AWS::AccountId"),
            }
        };


        this.serverless.service.getAllFunctions().forEach((fnName) => {
            if (fnName !== 'sumologicShipping') {
                const functionName = normalizeName(fnName);
                const functionObj = this.serverless.service.getFunction(functionName);

                // We will be able to do this soon
                // const logGroupLogicalId = this.provider.naming.getLogGroupLogicalId(functionName);

                const logGroupLogicalId = getLogGroupLogicalId(functionName)
                this.serverless.cli.log(logGroupLogicalId)

                const filterStatement = cloneDeep(filterBaseStatement);
                const filterStatementName = functionName + 'SubscriptionFilter';
                const logGroupPermissions = cloneDeep(cloudwatchLogsLambdaPermission);
                const logGroupPermissionName = functionName + 'InvokePermission';

                filterStatement.Properties.LogGroupName = fnGetRef(logGroupLogicalId);
                filterStatement.DependsOn.push(logGroupPermissionName);
                logGroupPermissions.SourceArn = fnGetAtt(logGroupLogicalId);

                const newFilterStatement = {
                    [`${filterStatementName}`]: filterStatement
                };
                const newLogGroupPermissions = {
                    [`${logGroupPermissionName}`]: logGroupPermissions
                }

                assignin(this.resources, newLogGroupPermissions);
                assignin(this.resources, newFilterStatement);
            }
        });
    }

    afterDeployDeploy() {
        this.serverless.cli.log('Removing temporary Cloudwatch to Sumologic lambda function');
        let functionPath = this.getEnvFilePath();

        try {
            if (fs.existsSync(functionPath)) {
                if (fs.existsSync(path.join(functionPath, 'handler.js'))) {
                    fs.unlinkSync(path.join(functionPath, 'handler.js'));
                }
                fs.rmdirSync(functionPath);
            }
        } catch (err) {
            throw new Error(err);
        }
    }
}

module.exports = Plugin;

