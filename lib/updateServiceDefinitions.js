const { SERVICE_DEFINITION_QUERY } = require("@apollo/gateway");
const { Headers } = require('node-fetch');
const fs = require('fs');
const{ parse  } =  require('graphql');

const file_updateServiceDefinitions = async (serviceList) => {
    return {
        isNewSchema: false,
        serviceDefinitions:  await Promise.all(serviceList.serviceList.map(async (service) => {
            var dataSource = serviceList.buildService(service)
            const request = {
                query: SERVICE_DEFINITION_QUERY,
                http: {
                    url: service.url,
                    method: 'POST',
                    headers: new Headers({}),
                },
            };
            const path = './services/'+service.name+'.gql'
            if (fs.existsSync(path)) {
                var typeDefs = fs.readFileSync(path).toString();
                console.log(service.name, 'Load local file')
                return {
                    name: service.name,
                    url: service.url,
                    typeDefs: parse(typeDefs),
                };
            }else{
                console.log(service.name, 'Load Remote service')
                return dataSource
                    .process({ request, context: {} })
                    .then(({ data, errors }) => {
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

module.exports = { file_updateServiceDefinitions }
