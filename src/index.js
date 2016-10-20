'use strict';

class Plugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;

        this.commands = {
            deploy: {
                lifecycleEvents: [
                    'resources',
                    'functions'
                ]
            }
        };

        this.hooks = {
            'before:deploy:createDeploymentArtifacts': this.beforeDeployCreateDeploymentArtifacts.bind(this)
        };
    }

    beforeDeployCreateDeploymentArtifacts() {
        console.dir(this.serverless);
        console.log('beforeDeployResources');
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