const net = require('net')

const client = new net.Socket()
const PORT = 31109;
const HOST = '127.0.0.1'

const teacherData = JSON.stringify({
    name: "Mr. Okon",
    passKey: "password",
    subjects: ["Engish"]
})

const command = `SET teacher:T001 ${teacherData}\n`

client.connect(PORT, HOST, ()=>{
    console.log("Connected to python Database Server...")
    client.write(command)
})

client.on("data", (data)=>{
    console.log(`Server Response:`, data.toString().trim())
    client.destroy()
})

client.on('close', ()=>{
    console.log('Teacher Profile created successfully!')
})
