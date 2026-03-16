export const healthPlugin = async (fastify) => {
    fastify.get('/health', async (_request, reply) => {
        return reply.send({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    });
};
//# sourceMappingURL=health.js.map