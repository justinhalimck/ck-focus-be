export function auth(req, res, next) {
    const user = req.headers['x-focus-user']
    if (!user && req.originalUrl.includes('/api/')) return res.status(401)
    req.user = user;
    next();
}

export function createAlert(
    user,
    notifyAt,
    title,
    body
) {
    return {
        user,
        notifyAt,
        title,
        body,
    }
}