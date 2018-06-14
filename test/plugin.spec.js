'use strict';
const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const cloneDeep = require('lodash.clonedeep');
const rewire = require('rewire');
const sinon = require('sinon');

const Plugin = rewire('../src');

const mockCollectorUrl = 'https://not-real.not-really-sumologic.com/12345'
const mockFn = 'mock-fn';
const mockFs = {
    existsSync: sinon.stub().returns(true),
    readFileSync: sinon.stub().returns('%collectorUrl%'),
    writeFileSync: sinon.spy()
};
const mockLogArn = 'arn:aws:lambda:region:account-id:function:mock-log-fn';
const mockOptions = { test: true };
const mockProvider = {};
const mockServerless = {
    cli: {
        log: sinon.spy()
    },
    config: {
        servicePath: 'mock-service-path'
    },
    getProvider: sinon.stub().returns(mockProvider),
    service: {
        custom: {
            shipLogs: {
                arn: mockLogArn,
                collectorUrl: mockCollectorUrl,
                filterPattern: false
            }
        },
        functions: {},
        getAllFunctions: sinon.stub().returns([mockFn, `${mockFn}_2`]),
        provider: {
            compiledCloudFormationTemplate: { Resources: {} },
            region: 'us-east-1',
        }
    }
};



describe("Plugin correctly updates CF template", () => {
    describe('constructor', () => {
        let myMockServerless, myMockOptions;
        beforeEach(() => {
            myMockServerless = cloneDeep(mockServerless);
            myMockOptions = cloneDeep(mockOptions);
        });

        it('Makes serverless and the opts available to itself', () => {
            const plugin = new Plugin(myMockServerless, myMockOptions)

            expect(plugin.serverless).to.deep.equal(mockServerless);
            expect(plugin.options).to.deep.equal(mockOptions);
        });

    });

    describe('getEnvFilePath', () => {
        let myMockServerless, myMockOptions;
        beforeEach(() => {
            myMockServerless = cloneDeep(mockServerless);
            myMockOptions = cloneDeep(mockOptions);
        });

        it('Gets the ENV file path', () => {
            const plugin = new Plugin(myMockServerless, myMockOptions)
            const envFilePath = plugin.getEnvFilePath();

            expect(envFilePath).to.include(
                myMockServerless.config.servicePath,
                '/',
                plugin.sumoFnName
            );
        });
    });

    describe('beforeDeployCreateDeploymentArtifacts', () => {
        let myMockServerless, myMockOptions, revertFs;
        beforeEach(() => {
            revertFs = Plugin.__set__('fs', mockFs)
            myMockServerless = cloneDeep(mockServerless);
            myMockOptions = cloneDeep(mockOptions);
        });

        afterEach(() => {
            revertFs();
        });

        it('Skips creating a Sumologic Lambda Function if an ARN is passed', () => {
            const plugin = new Plugin(myMockServerless, myMockOptions)
            const sumoFn = plugin.beforeDeployCreateDeploymentArtifacts()

            expect(sumoFn).to.be.an('undefined');
        });

        it('Creates a Sumologic Lambda Function if no ARN is passed', () => {
            delete myMockServerless.service.custom.shipLogs.arn;

            const plugin = new Plugin(myMockServerless, myMockOptions)
            const pluginFs = Plugin.__get__('fs');
            plugin.beforeDeployCreateDeploymentArtifacts()

            expect(myMockServerless.service.functions.sumologicShipping).to.be.an('object');
            expect(myMockServerless.service.functions.sumologicShipping.handler).to.include(plugin.sumoFnName);
            expect(pluginFs.existsSync.callCount).to.equal(1);
            expect(pluginFs.readFileSync.callCount).to.equal(1);
            expect(pluginFs.writeFileSync.callCount).to.equal(1);
            expect(pluginFs.writeFileSync.firstCall.args).to.include(mockCollectorUrl);
        });

    });

    describe('deployCompileEvents', () => {
        let myMockServerless, myMockOptions,
            fnGetAttSpy, fnGetAtt,
            fnGetRefSpy, fnGetRef,
            normalizeNameSpy, normalizeName,
            getNormalizedFunctionNameSpy, getNormalizedFunctionName,
            getLogGroupLogicalIdSpy, getLogGroupLogicalId;

        beforeEach(() => {
            myMockServerless = cloneDeep(mockServerless);
            myMockOptions = cloneDeep(mockOptions);

            fnGetAttSpy = Plugin.__set__('fnGetAtt',
                sinon.spy(Plugin.__get__('fnGetAtt')));
            fnGetRefSpy = Plugin.__set__('fnGetRef',
                sinon.spy(Plugin.__get__('fnGetRef')));
            normalizeNameSpy = Plugin.__set__('normalizeName',
                sinon.spy(Plugin.__get__('normalizeName')));
            getNormalizedFunctionNameSpy = Plugin.__set__('getNormalizedFunctionName',
                sinon.spy(Plugin.__get__('getNormalizedFunctionName')));
            getLogGroupLogicalIdSpy = Plugin.__set__('getLogGroupLogicalId',
                sinon.spy(Plugin.__get__('getLogGroupLogicalId')));

            fnGetAtt = Plugin.__get__('fnGetAtt');
            fnGetRef = Plugin.__get__('fnGetRef');
            normalizeName = Plugin.__get__('normalizeName');
            getNormalizedFunctionName = Plugin.__get__('getNormalizedFunctionName');
            getLogGroupLogicalId = Plugin.__get__('getLogGroupLogicalId');
        });

        afterEach(() => {
            fnGetAttSpy()
            fnGetRefSpy()
            normalizeNameSpy()
            getNormalizedFunctionNameSpy()
            getLogGroupLogicalIdSpy()
            myMockServerless.cli.log.resetHistory()
            myMockServerless.service.getAllFunctions.resetHistory()
        });

        it('Gets all serverless functions', () => {
            const plugin = new Plugin(myMockServerless, myMockOptions)
            plugin.deployCompileEvents();

            expect(plugin.serverless.service.getAllFunctions.callCount).to.equal(1);
            expect(getNormalizedFunctionName.callCount).to.equal(4);
            expect(getLogGroupLogicalId.callCount).to.equal(2);
        });

        it('Normalizes function names', () => {
            const plugin = new Plugin(myMockServerless, myMockOptions)
            plugin.deployCompileEvents();

            expect(getNormalizedFunctionName.callCount).to.equal(4);
            expect(getLogGroupLogicalId.firstCall.args).not.to.include('-');
            expect(getLogGroupLogicalId.firstCall.args).to.include('MockFn');
        });

        it('Gets LogGroupLogicalIds', () => {
            const plugin = new Plugin(myMockServerless, myMockOptions)
            plugin.deployCompileEvents();

            expect(plugin.serverless.cli.log.callCount).to.equal(3);
            expect(plugin.serverless.cli.log.secondCall.args).to.include('MockFnLogGroup');
            expect(plugin.serverless.cli.log.thirdCall.args).to.include('MockFn2LogGroup');
        });

        /**
         * Low hanging fruit
         *
         * Make this its own Describe, and actually check each aspect of the objects
         * that we expect it to add for the right props, etc.
         */

        it('Updates Resources with new permissions & subscription filters', () => {
            const plugin = new Plugin(myMockServerless, myMockOptions)

            const slsResources = plugin.serverless.service.provider.compiledCloudFormationTemplate.Resources;
            expect(Object.keys(slsResources).length).to.equal(0);
            plugin.deployCompileEvents();
            expect(Object.keys(slsResources).length).to.equal(4);
            expect(Object.keys(slsResources)).to.include(
                'MockFnSubscriptionFilter', 'MockFnInvokePermission',
                'MockFn2SubscriptionFilter', 'MockFn2InvokePermission'
            );
        })
    })
});
