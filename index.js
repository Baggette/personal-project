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
            io.emit('chat', message, username)
        }
        else
        {
            socket.emit('error', 'Invalid token')
        }
    })
})
server.listen(port, () => {
    console.log(`Running on port ${port}`)
})