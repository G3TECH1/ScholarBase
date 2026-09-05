const net = require('net')

const validCommand = `SECURE_SET password Engish teacher:T001 {"English": 85}\n`

const invalidCommand = `SECURE_SET password Mathematics teacher:T001 {"Maths": 90}\n`

function sendTest(command, label){
    const client = new net.Socket()
    client.connect(31109, '127.0.0.1', ()=>{
        console.log(`\n Testing: ${label}`)
        client.write(command)
    })

    client.on('data', (data)=>{
        console.log(`Server Output: ${data.toString().trim()}`)
        client.destroy()
    })
}

sendTest(validCommand, "Mr Okon Updating English (His Subject)")

setTimeout(()=>{
    sendTest(invalidCommand, "Mr Okn updating Maths (Unauthorized subject)")
}, 1000)