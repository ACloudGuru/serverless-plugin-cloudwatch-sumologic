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
            'deploy:compileEvents': this.deployCompileEvents.bind(this)
        };
    }

    getEnvFilePath() {
        return path.join(this.serverless.config.servicePath, 'sumologic-shipping-function');
    }

    beforeDeployCreateDeploymentArtifacts() {
        var functionPath = this.getEnvFilePath();

        if (!fs.existsSync(functionPath)) {
            fs.mkdirSync(functionPath);
        }

        var templatePath = path.resolve(__dirname, '../sumologic-function/handler.template.js');

        var templateFile = fs.readFileSync(templatePath, 'utf-8');

        var collectorUrl = this.serverless.service.custom.shipLogs.collectorUrl;

        var handlerFunction = templateFile.replace('%collectorUrl%', collectorUrl);

        fs.writeFileSync(path.join(functionPath, 'handler.js'), handlerFunction);

        var functionNames = Object.keys(this.serverless.service.functions);

        this.serverless.service.functions.sumologicShippingFunction = {
            handler: '.temp/sumologic-shipping-function',
            events: [],
            name: 'sumologic-shipping-function'
        };

        console.log(functionNames);

        console.log(collectorUrl);

        console.log(functionPath);

        console.log(templatePath);

        console.log(handlerFunction);
    }

    deployCompileEvents() {
        var filterPattern = !!this.serverless.service.custom.shipLogs.filterPattern ? this.serverless.service.custom.shipLogs.filterPattern : "[timestamp=*Z, request_id=\"*-*\", event]";

        console.dir(this.serverless.service.provider.compiledCloudFormationTemplate);

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

        var cloudwatchLogsLambdaPermission = {
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

                console.log(filterStatement);

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
}

module.exports = Plugin;
