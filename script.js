const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

let absForces=[];
let times=[];

let zeroForce = 0.0;
let minForce = Infinity;
let maxForce = -Infinity;

const connection = {
    device: null,
    characteristic: null
};

const appStates = {
    connected: false, //unused
    paused: false
};

const canvas=document.getElementById("chart");
const ctx=canvas.getContext("2d");

function drawGraph(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if(absForces.length < 2)
        return;

    let min=Math.min(...absForces);
    let max=Math.max(...absForces);

    if(max-min < 11){
        max=min+11;
    }

    let margin=50;
    let width=canvas.width-margin*2;
    let height=canvas.height-margin*2;

    // Draw axes
    ctx.strokeStyle="black";
    ctx.lineWidth=1;

    ctx.beginPath();
    ctx.moveTo(margin,margin);
    ctx.lineTo(margin,canvas.height-margin);
    ctx.lineTo(canvas.width-margin, canvas.height-margin);
    ctx.stroke();

    // Labels
    ctx.font="14px Arial";
    ctx.fillStyle="black";
    ctx.fillText(
        max.toFixed(1),
        5,
        margin+10
    );

    ctx.fillText(
        min.toFixed(1),
        5,
        canvas.height-margin
    );

    // Graph line
    ctx.strokeStyle="blue";
    ctx.lineWidth=3;
    ctx.beginPath();

    absForces.forEach((v,i)=>{
        let x =
        margin +
        (i/(absForces.length-1))*width;

        let y =
        canvas.height-margin -
        ((v-min)/(max-min))*height;

        if(i===0)
            ctx.moveTo(x,y);
        else
            ctx.lineTo(x,y);
    });

    ctx.stroke();

    // Points
    ctx.fillStyle="red";
    absForces.forEach((v,i)=>{
        let x =
        margin +
        (i/(absForces.length-1))*width;

        let y =
        canvas.height-margin -
        ((v-min)/(max-min))*height;

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI*2);
        ctx.fill();
    });
}

function toggleConnection(){
    if (!connection.characteristic){
        connect()
    } else{
        disconnect()
    }
}

async function connect(){
    try{
        connection.device = await navigator.bluetooth.requestDevice({filters:[{services:[SERVICE_UUID]}]});
        document.getElementById("connection-value").textContent ="Connecting...";
        connection.device.addEventListener("gattserverdisconnected", connectionLost);
        

        const server = await connection.device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        connection.characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
        await connection.characteristic.startNotifications();

        connection.characteristic.addEventListener("characteristicvaluechanged", handleNotification);
        document.getElementById("connection-value").textContent = "Connected";
        document.getElementById("connect-button").textContent = "Disconnect";

        initialize()
    }

    catch (e) {
    console.error("Connection failed:", e);

    connection.characteristic = null;

    if (connection.device?.gatt?.connected) {
        connection.device.gatt.disconnect();
    }

    connection.device = null;

    document.getElementById("connection-value").textContent =
        "Disconnected";
    document.getElementById("connect-button").textContent =
        "Connect";

    alert(e.message || String(e));
    }
}

async function disconnect() {
    try {
        const device = connection.device;
        const characteristic = connection.characteristic;

        if (characteristic) {
            try {
                await characteristic.stopNotifications();
            } catch (e) {
                // Device may already be disconnected
            }

            characteristic.removeEventListener(
                "characteristicvaluechanged",
                handleNotification
            );
        }

        if (device?.gatt?.connected) {
            device.gatt.disconnect();
        }

        connection.characteristic = null;
        connection.device = null;

        document.getElementById("connection-value").textContent =
            "Disconnected";
        document.getElementById("connect-button").textContent =
            "Connect";

    } catch (e) {
        console.error("Disconnect failed:", e);
    }
}

function connectionLost(){
  document.getElementById("connection-value").textContent = "Disconnected";
  document.getElementById("connect-button").textContent = "Connect";
  connection.characteristic = null;
  connection.device = null;
}

function initialize() {
    zeroForce = 0.0;
    minForce = Infinity;
    maxForce = -Infinity;

    absForces = [];
    times = [];
    drawGraph();

    document.getElementById("zero-force-value").textContent = 0;
    document.getElementById("rel-force-value").textContent = 0;
    document.getElementById("abs-force-value").textContent = 0;
}

function togglePause(){
    appStates.paused = !appStates.paused;
    if (appStates.paused){
            document.getElementById("pause-button").textContent = "Resume";
    } else {
            document.getElementById("pause-button").textContent = "Pause";
    }
}

function setZero(){
    if (absForces.length === 0) return;
    zeroForce = absForces[absForces.length-1];
    document.getElementById("zero-force-value").textContent = formatForceValue(zeroForce);
}

function removeZero(){
    zeroForce = 0.0;
    document.getElementById("zero-force-value").textContent = formatForceValue(zeroForce);
}

function setMin(){
    if (absForces.length === 0) return;
    minForce = absForces[absForces.length-1];
    document.getElementById("min-force-value").textContent = formatForceValue(minForce);
}

function setMax(){
    if (absForces.length === 0) return;
    maxForce = absForces[absForces.length-1];
    document.getElementById("max-force-value").textContent = formatForceValue(maxForce);
}

function handleNotification(event){
    const value = event.target.value;
    const absForce = value.getFloat32(0,true);
    const relForce = absForce - zeroForce

    if (absForce<minForce){minForce = absForce}
    if (absForce>maxForce){maxForce = absForce}

    document.getElementById("abs-force-value").textContent = formatForceValue(absForce);
    document.getElementById("rel-force-value").textContent = formatForceValue(relForce);
    document.getElementById("min-force-value").textContent = formatForceValue(minForce);
    document.getElementById("max-force-value").textContent = formatForceValue(maxForce);
    
    absForces.push(absForce);
    times.push(new Date().toLocaleTimeString());

    if(absForces.length > 100){
        absForces.shift();
        times.shift();
    }

    if (!appStates.paused){
        drawGraph();
    }
}

function formatForceValue(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return "-";
    }

    if (value > 99.99){
        return "99.99"
    } else if (value < -9.99){
        return "-9.99"
    }

    return value.toFixed(2).padStart(5, "0");
}
