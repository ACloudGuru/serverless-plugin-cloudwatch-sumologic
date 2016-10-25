'use strict';

const path = require('path');
const fs = require('fs');
const _ = require('lodash');

class Plugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;

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

        this.serverless.service.functions.sumologicShippingFunction = {
            handler: 'sumologic-shipping-function/handler.handler',
            events: [],
            name: 'sumologic-shipping-function'
        };
    }

    deployCompileEvents() {
        this.serverless.cli.log('Generating subscription filters and lambda function log groups');
        let filterPattern = !!this.serverless.service.custom.shipLogs.filterPattern ? this.serverless.service.custom.shipLogs.filterPattern : "[timestamp=*Z, request_id=\"*-*\", event]";

        const filterBaseStatement = {
            Type: "AWS::Logs::SubscriptionFilter",
            Properties: {
                DestinationArn: {
                    "Fn::GetAtt": [
                        "SumologicShippingFunctionLambdaFunction",
                        "Arn"
                    ]
                },
                FilterPattern: filterPattern
            },
            DependsOn: ["cloudwatchLogsLambdaPermission"]
        }

        const logGroupBaseStatement = {
            Type: "AWS::Logs::LogGroup",
            Properties: {}
        };

        Object.freeze(filterBaseStatement); // Make it immutable
        Object.freeze(logGroupBaseStatement);

        let cloudwatchLogsLambdaPermission = {
            Type: "AWS::Lambda::Permission",
            Properties: {
                FunctionName: {
                    "Fn::GetAtt": [
                        "SumologicShippingFunctionLambdaFunction",
                        "Arn"
                    ]
                },
                Action: "lambda:InvokeFunction",
                Principal: "logs.us-east-1.amazonaws.com"
            }
        }

        this.serverless.service.provider.compiledCloudFormationTemplate.Resources.cloudwatchLogsLambdaPermission = cloudwatchLogsLambdaPermission;

        this.serverless.service.getAllFunctions().forEach((functionName) => {
            if (functionName !== 'sumologicShippingFunction'){
                const functionObj = this.serverless.service.getFunction(functionName);

                let filterStatement = filterBaseStatement;
                let logGroupStatement = logGroupBaseStatement;

                filterStatement.Properties.LogGroupName = '/aws/lambda/' + functionObj.name;
                logGroupStatement.Properties.LogGroupName = '/aws/lambda/' + functionObj.name;

                let filterStatementName = functionName + 'SumoLogicSubscriptionFilter';
                let logGroupStatementName = functionName + 'LogGroup';

                filterStatement.DependsOn.push(logGroupStatementName);

                let newFilterStatement = {
                    [`${filterStatementName}`]: filterStatement
                };

                let newLogGroupStatement = {
                    [`${logGroupStatementName}`]: logGroupStatement
                };

                _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, newFilterStatement, newLogGroupStatement);
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
