const {ApolloServer, ApolloError} = require("apollo-server-express");
const {ApolloGateway} = require("@apollo/gateway");
const updateServiceDefinitions = require("./lib/updateServiceDefinitions")
const Sentry = require("@sentry/node");
const fs = require('fs');
const BuildGraphQLDataSource = require("./lib/BuildGraphQLDataSource")

class GqlApolloGateway {
    constructor(list, path) {
        this.ServiceList = list
        this.ServiceDefinitions = new updateServiceDefinitions(path || './services')
        this.config = {
            serviceList: this.ServiceList,
            serviceHealthCheck: false,
            buildService: ({name, url}) => {
                return new BuildGraphQLDataSource({url})
            },
            __exposeQueryPlanExperimental: false,
            experimental_updateServiceDefinitions: this.ServiceDefinitions.remote_updateServiceDefinitions
        }
    }
     async load() {
        let gateway = new ApolloGateway(this.config)
        let gatewayConfig
        try {
            gatewayConfig = await gateway.load()
        } catch (e) {
            console.log("Remote service Error:",e)
            this.config.experimental_updateServiceDefinitions = this.ServiceDefinitions.file_updateServiceDefinitions
            gateway = new ApolloGateway(this.config)
            try {
                gatewayConfig = await gateway.load()
            } catch (e){
                this.ServiceDefinitions.rmFilesCache(this.ServiceList)
                Sentry.captureException(e);
                throw new Error(e)
            }
        }

        return new ApolloServer({
            ...gatewayConfig,
            uploads: false,
            subscriptions: false,
            context: async ({req}) => {
                let user = req.user || null;
                let token = req.headers['authorization'] || null
                if (token !== null) {
                    token = token.split(" ")[1]
                }
                return {user, token};
            },
            plugins: [
                {
                    requestDidStart(_) {
                        return {
                            didEncounterErrors(ctx) {
                                if (!ctx.operation) {
                                    return;
                                }

                                for (const err of ctx.errors) {
                                    if (err instanceof ApolloError) {
                                        continue;
                                    }
                                    Sentry.withScope(scope => {
                                        scope.setTag("kind", ctx.operation.operation);
                                        scope.setExtra("headers", ctx.request.http.headers);
                                        scope.setExtra("query", ctx.request.query);
                                        scope.setExtra("variables", ctx.request.variables);
                                        scope.setExtra("variablesJson", JSON.stringify(ctx.request.variables));


                                        if (err.path) {
                                            scope.addBreadcrumb({
                                                category: "query-path",
                                                message: err.path.join(" > "),
                                                level: Sentry.Severity.Debug
                                            });
                                        }

                                        const transactionId = ctx.request.http.headers.get(
                                            "x-transaction-id"
                                        );
                                        if (transactionId) {
                                            scope.setTransaction(transactionId);
                                        }

                                        Sentry.captureException(err);
                                    });
                                }
                            }
                        };
                    }
                }
            ]
        })
    }
}
module.exports = {GqlApolloGateway}

