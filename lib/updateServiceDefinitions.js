const {SERVICE_DEFINITION_QUERY} = require("@apollo/gateway");
const {Headers} = require('node-fetch');
const fs = require('fs');
const {parse} = require('graphql');

class UpdateServiceDefinitions {
    constructor(path) {
        this.path = path
    }
    rmFilesCache(serviceList) {
        let self_path = './services'
        serviceList?.forEach(service => {
            const path = self_path + '/' + service.name + '.gql'
            fs.unlink(path, (err) => {
                if (err) {
                    throw new err
                }
            })
        })
    }
    async remote_updateServiceDefinitions(serviceList) {
        let self_path = './services'
        return {
            isNewSchema: false,
            serviceDefinitions: await Promise.all(serviceList.serviceList.map(async (service) => {
                let dataSource = serviceList.buildService(service)
                const request = {
                    query: SERVICE_DEFINITION_QUERY,
                    http: {
                        url: service.url,
                        method: 'POST',
                        headers: new Headers({}),
                    },
                };
                const path =  self_path + '/' + service.name + '.gql'
                    console.log(service.name, 'Load Remote service')
                    return dataSource
                        .process({request, context: {}})
                        .then(({data, errors}) => {
                            if (data && !errors) {
                                const typeDefs = data._service.sdl
                                fs.writeFileSync(path, typeDefs)
                                return {
                                    name: service.name,
                                    url: service.url,
                                    typeDefs: parse(typeDefs),
                                };
                            }

                            throw new Error(errors.map(e => e.message).join("\n"));
                        })
                        .catch(err => {
                            const errorMessage =
                                `Couldn't load service definitions for "${service.name}" at ${service.url}` +
                                (err && err.message ? ": " + err.message || err : "");

                            throw new Error(errorMessage);
                        });
            }))
        }
    }
    async file_updateServiceDefinitions(serviceList) {
        let self_path = './services'
        return {
            isNewSchema: false,
            serviceDefinitions: await Promise.all(serviceList.serviceList.map(async (service) => {
                            let dataSource = serviceList.buildService(service)
                            const request = {
                                    query: SERVICE_DEFINITION_QUERY,
                                    http: {
                                        url: service.url,
                                        method: 'POST',
                                        headers: new Headers({}),
                                    },
                                };
                            const path =  self_path + '/' + service.name + '.gql'
                            if (fs.existsSync(path)) {
                                let typeDefs = fs.readFileSync(path).toString();
                                console.log(path,'Load local file')
                                return {
                                    name: service.name,
                                    url: service.url,
                                    typeDefs: parse (typeDefs),
                                };
                            } else {
                                console.log(service.name, 'Load Remote service')
                                return dataSource
                                    .process({request, context: {}})
                                    .then(({data, errors}) => {
                                        if (data && !errors) {
                                            const typeDefs = data._service.sdl
                                            fs.writeFileSync(path, typeDefs)
                                            return {
                                                name: service.name,
                                                url: service.url,
                                                typeDefs: parse(typeDefs),
                                            };
                                        }

                                        throw new Error(errors.map(e => e.message).join("\n"));
                                    })
                                    .catch(err => {
                                        const errorMessage =
                                            `Couldn't load service definitions for "${service.name}" at ${service.url}` +
                                            (err && err.message ? ": " + err.message || err : "");

                                        throw new Error(errorMessage);
                                    });
                            }
                        }))
        }
    }
}

module.exports = UpdateServiceDefinitions
