import { faker } from "@faker-js/faker";

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

export function createUser(
    id,
) {
    return {
        uuid: faker.string.uuid(),
        id: id,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        role: faker.person.jobTitle(),
        img: faker.image.avatarGitHub(),
        department: faker.commerce.department(),
    }
}