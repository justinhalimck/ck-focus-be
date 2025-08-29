require('dotenv').config()

const express = require('express')
const bodyParser = require('body-parser')
const webpush = require('web-push')
const cors = require('cors')
const { auth, createAlert, createUser } = require('./lib')

const {
    MinPriorityQueue,
} = require('@datastructures-js/priority-queue');

const app = express()
app.use(bodyParser.json())
app.use(cors({origin: '*'}))
app.use(auth)

const subscriptions = new Map();
const users = new Map();
const invitations = new Map() // invitationId => userId => pending/accepted/rejected

const publicVapidKey = process.env.VAPID_PUBLIC_KEY
const privateVapidKey = process.env.VAPID_PRIVATE_KEY

webpush.setVapidDetails(
  'mailto:ck-focus@incin.net',
  publicVapidKey,
  privateVapidKey
)

function sendAlert(alert) {
    if(!(subscriptions.has(alert.user))) return console.error(alert, "has no subscription");
    console.log("SENDING ALERT TO", alert.user)
    webpush.sendNotification(JSON.parse(subscriptions.get(alert.user)), JSON.stringify({ title: alert.title, body: alert.body }))
      .catch(err => console.error(err))
}

function sendInvitation(id, from, to) {
    if (!subscriptions.has(to)) {
        console.error("subscription not found", to, subscriptions);
        return;
    }

    if (!invitations.has(id)) {
        invitations.set(id, new Map())
    }
    invitations.get(id).set(to, "pending")

    console.log("SENDING INVITATION", from, to)
    webpush.sendNotification(JSON.parse(subscriptions.get(to)), JSON.stringify({
        title: "invite",
        body: {
            id,
            from: users.get(from).firstName ?? from,
            to: users.get(to).lastName ?? to,
        }
    }))
}

const queue = new MinPriorityQueue((e) => e.notifyAt)

const worker = setInterval(() => {
    while(queue.size() > 0 && !queue.front().notifyAt) {
        queue.dequeue();
    }
    while(queue.size() > 0 && queue.front().notifyAt <= Date.now()) {
        const top = queue.dequeue();
        sendAlert(top)
    }
}, 1000)

// Store subscription
app.post('/api/subscribe', (req, res) => {
    const user = req.user;
    if(!users.has(req.user)) {
        users.set(user, createUser(req.user));
    }
    
    const subscription = req.body.subscription
    subscriptions.set(user, subscription);
    res.status(201).json({})
})

// Trigger an alarm after X seconds
app.post('/api/alarm', (req, res) => {
    console.log("REG ALARM")
    const user = req.user;
    if(!subscriptions.has(user)) {
        console.error(`user ${req.user} not subscribed`)
        return res.status(400).json({error: "user is not subscribed"})
    }

    const { notifyAt, title, body } = req.body;
    if(!notifyAt || !title || !body) {
        console.error("missing", notifyAt, title, body)
        return res.status(400)
    };

    const alert = createAlert(user, notifyAt, title, body);
    console.log(alert);
    queue.enqueue(alert)

    res.json({ status: 'Alarm scheduled' })
})

app.delete('/api/alarm', (req, res) => {
    console.log("CLEAR ALARMS", req.user)
    queue.remove((v) => v.user === req.user);

    res.status(200).json({msg: "alarm cleared"})
})

app.get('/api/me', (req, res) => {
    if(!users.has(req.user)) {
        users.set(req.user, createUser(req.user));
    }
    res.status(200).json(users.get(req.user));
})

app.post('/api/invite', (req, res) => {
    const id = req.body.id;
    const from = req.user;
    const to = req.body.to; 
    sendInvitation(id, from, to);
    res.status(200).json({ status: 'Invitation sent' });
})

app.post('/api/invite/respond', (req, res) => {
    const id = req.body.id;
    const user = req.user
    const response = req.body.response
    if (!invitations.has(id)) {
        return res.status(404).json({ error: 'Invitation not found' })
    }
    invitations.get(id).set(user, response)
    res.status(200).json({ status: 'Invitation response recorded' });
})

app.get('/api/users', (req, res) => {
    return res.status(200).json({users: [...users.values()]})
})

app.get('/', (req, res) => {
    res.status(200).json({msg: 'home'})
})

app.listen(5175, () => console.log('Server running on http://localhost:5175'))