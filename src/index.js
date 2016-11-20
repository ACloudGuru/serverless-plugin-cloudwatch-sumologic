'use strict';

const path = require('path');
const fs = require('fs');
const _ = require('lodash');

class Plugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('aws');

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
        this.serverless.cli.log('Checking if serverless is managing logs via cloudformation');
        let cflogsEnabled = this.serverless.service.provider.cfLogs;

        if (!cflogsEnabled) {
            throw new Error('To use serverless-plugin-cloudwatch-sumologic you must have cfLogs set to true in the serverless.yml file. See https://serverless.com/framework/docs/providers/aws/guide/functions/#log-group-resources for more information.')
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

        fs.writeFileSync(path.join(functionPath, 'handler.js'), handlerFunction);

        this.serverless.service.functions.sumologicShipping = {
            handler: 'sumologic-shipping-function/handler.handler',
            events: []
        };
    }

    deployCompileEvents() {
        this.serverless.cli.log('Generating subscription filters');
        let filterPattern = !!this.serverless.service.custom.shipLogs.filterPattern ? this.serverless.service.custom.shipLogs.filterPattern : "[timestamp=*Z, request_id=\"*-*\", event]";

        const filterBaseStatement = {
            Type: "AWS::Logs::SubscriptionFilter",
            Properties: {
                DestinationArn: {
                    "Fn::GetAtt": [
                        "SumologicShippingLambdaFunction",
                        "Arn"
                    ]
                },
                FilterPattern: filterPattern
            },
            DependsOn: ["cloudwatchLogsLambdaPermission"]
        };

        Object.freeze(filterBaseStatement); // Make it immutable
        const principal = `logs.${this.serverless.service.provider.region}.amazonaws.com`;
        let cloudwatchLogsLambdaPermission = {
            Type: "AWS::Lambda::Permission",
            Properties: {
                FunctionName: {
                    "Fn::GetAtt": [
                        "SumologicShippingLambdaFunction",
                        "Arn"
                    ]
                },
                Action: "lambda:InvokeFunction",
                Principal: principal
            }
        };

        this.serverless.service.provider.compiledCloudFormationTemplate.Resources.cloudwatchLogsLambdaPermission = cloudwatchLogsLambdaPermission;

        this.serverless.service.getAllFunctions().forEach((functionName) => {
            if (functionName !== 'sumologicShipping') {
                const functionObj = this.serverless.service.getFunction(functionName);

                // We will be able to do this soon
                // const logGroupLogicalId = this.provider.naming.getLogGroupLogicalId(functionName);

                const logGroupLogicalId = getLogGroupLogicalId(functionName)

                let filterStatement = filterBaseStatement;

                filterStatement.Properties.LogGroupName = `/aws/lambda/${functionObj.name}`;

                let filterStatementName = functionName + 'SumoLogicSubscriptionFilter';

                filterStatement.DependsOn.push(logGroupLogicalId);

                let newFilterStatement = {
                    [`${filterStatementName}`]: filterStatement
                };

                _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, newFilterStatement);
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

// Remove after 1.1.1 release
function normalizeName(name) {
    return `${_.upperFirst(name)}`;
}

function getNormalizedFunctionName(functionName) {
    return normalizeName(functionName
        .replace(/-/g, 'Dash')
        .replace(/_/g, 'Underscore'));
}

function getLogGroupLogicalId(functionName) {
    return `${getNormalizedFunctionName(functionName)}LogGroup`;
}
