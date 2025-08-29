require('dotenv').config()

const express = require('express')
const bodyParser = require('body-parser')
const webpush = require('web-push')
const cors = require('cors')
const { auth, createAlert } = require('./lib')

const {
    MinPriorityQueue,
} = require('@datastructures-js/priority-queue');

const app = express()
app.use(bodyParser.json())
app.use(cors({origin: '*'}))
app.use(auth)

const subscriptions = new Map();

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

app.get('/', (req, res) => {
    res.status(200).json({msg: 'home'})
})

app.listen(5175, () => console.log('Server running on http://localhost:5175'))