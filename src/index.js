'use strict';

var path = require('path');
var fs = require('fs');

class Plugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;

        this.hooks = {
            'before:deploy:createDeploymentArtifacts': this.beforeDeployCreateDeploymentArtifacts.bind(this)
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
}

module.exports = Plugin;

// 'use strict';

// class Deploy {
//   constructor(serverless, options) {
//     this.options = options;

//     this.commands = {
//       deploy: {
//         lifecycleEvents: [
//           'functions'
//         ],
//         options: {
//           function: {
//             usage: 'Specify the function you want to deploy (e.g. "--function myFunction" or "-f myFunction")',
//             required: true,
//             shortcut: 'f'
//           }
//         }
//       },
//     };

//     this.hooks = {
//       'deploy:functions': this.deployFunction.bind(this)
//     }
//   }

//   deployFunction() {
//     console.log('Deploying function: ', this.options.function);
//   }
// }

// module.exports = Deploy;
