const express = require('express')
const app = express()
const port = 3005
const http = require('http')
const server = http.createServer(app)
const { Server } = require('socket.io')
const io = new Server(server)
const { QuickDB } = require('quick.db')
const db = new QuickDB()
const bcrypt = require('bcrypt')
const {v4: uuidv4} = require('uuid')
const socketIORateLimiter = require('@d3vision/socket.io-rate-limiter')

app.use(express.static('webpages'))

io.on('connection', async (socket) => {

    console.log("a user connected")
    socket.on('disconnect', () => {
        console.log("user disconnected")
    })

    socket.on('register', async (data) => {
        //assign the data variable (which is just some json like {username: "username", password: "password"}) to the variables username and password
        const username = data.username
        const password = data.password
        const users = await db.get('users', [])
        //check if the username already exists in the database
        if(users.includes(username)) 
        {
            console.log("Username already exists")
            socket.emit('error', 'Username already exists')
        }//if the username does not exist in the database, hash the password and push the username to the users array in the database
        else 
        {
            const passwordHash = await bcrypt.hash(password, 10)
            await db.push('users', username)
            await db.set(username, passwordHash)
            console.log("User registered")
            socket.emit('success')
        }
        
    })

    socket.on('login', async (data) => {
        const username = data.username
        const password = data.password
        const users = await db.get('users', [])
        //check if the username exists in the database
        if(users.includes(username))
        {
            const passwordHash = await db.get(username)
            //check if the password is correct
            if(await bcrypt.compare(password, passwordHash))
            {
                console.log("User logged in")
                const token = uuidv4()
                await db.set(`${username}-token`, token)
                socket.emit('success', token, username)
            }
            else
            {
                console.log("Incorrect password")
                socket.emit('error', 'Incorrect password')
            }
        }
        else
        {
            console.log("Username does not exist")
            socket.emit('error', 'Username does not exist')
        }
    })

    socket.on('chat', async (message, username, token) => {
        if(await db.get(`${username}-token`) == token)
        {
            if(Number(await db.get('messages.amount') == null || Number(await db.get('messages.amount') < 0) || Number(await db.get('messages.amount') == NaN))) {
                await db.set('messages.amount', '0')
            }
            const messageid = Number(await db.get('messages.amount'))
            await db.set('messages.amount', `${messageid + 1}`)
            await db.push('messages.messages', {messageid : `${Number(await db.get("messages.amount"))}`, message : message, username : username})
            io.emit('chat', message, username, messageid)
        }
        else
        {
            socket.emit('error', 'Invalid token')
        }
    })

    socket.on('load', async () => {
        const messageid = Number(await db.get('messages.amount')) - 1
        
        for(let i = 0/*messageid - 40*/; i <= messageid; i++)
        {
            const message = await db.get(`messages.messages.${i}.message`)
            const username = await db.get(`messages.messages.${i}.username`)
            socket.emit('chat', message, username)
        }
    })

})

io.on('connection', (socket) => {
    socket.use(socketIORateLimiter({maxBurst: 3, perSecond: 1, gracePeriodInSeconds: 5, emitClientHtmlError: true}, socket))

    function formatUsernames(usernames) {
        if (usernames.length === 0) {
            return "";
        } else if (usernames.length === 1) {
            return `${usernames[0]} is typing`;
        } else if (usernames.length === 2) {
            return `${usernames[0]} and ${usernames[1]} are typing`;
        } else {
            const allButLast = usernames.slice(0, -1).join(', ');
            const last = usernames[usernames.length - 1];
            return `${allButLast}, and ${last} are typing`;
        }
    }

    socket.on("typing", async (username) => {

        const typingusr = await db.get(`message.typing.${username}`)
        if(typingusr == true) return console.log(`${username} is already typing`)

        await db.set(`message.typing.${username}`, true)
        await db.push("typing", username)
        const usernames = formatUsernames(await db.get("typing"))
        console.log(usernames)
        socket.broadcast.emit('typing', `${usernames}`)
        console.log(`${username} is typing`)
    })

    socket.on("stoppedtyping", async (username) => {
        try{
        await db.set(`message.typing.${username}`, false)
        var usernames = await db.get("typing")
        usernames = usernames.filter(e => e !== username)
        await db.set("typing", usernames)
        rmusr = formatUsernames(usernames)
        socket.broadcast.emit('stoppedtyping', rmusr)
        console.log(`${username} stopped typing`)
        }
        catch(e){
            console.log(e)
            return;
        }
    })
})

server.listen(port, () => {
    console.log(`Running on port ${port}`)
})