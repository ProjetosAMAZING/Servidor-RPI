var spi = require('spi-device'),
  sp;
var express = require('express');
var io = require('socket.io');
var Gpio = require('onoff').Gpio
//var Gpio = require('pigpio').Gpio
var rf_state = 'M_STDBY'; 
var ack_received  = 0;
var packet_received = 0;
var packet_sent = 0;
var timeout = 0;




sp = spi.openSync(0, 1, function (err) {
  if (err) throw err;
  // An SPI message is an array of one or more read+write transfer
});

var dataUI = { vel : 0,sent : 1};

var app = express();

app.use(express.static(__dirname +'/public'))

app.get('/',function(req,res,next){
res.sendFile(__dirname + 'index.html');
});

var server = app.listen(3000);
var socket = require('socket.io');
var io = socket(server);

io.on('connection', function(socket,packet_sent){
		console.log('user connected');
		/*setInterval(function(){
			socket.emit('hey',Sent a message 4 seconds after connection');
		},400);
		
		*/
	socket.on('carstate',function(data){
		dataUI.vel=data.speed;
				
		if(data.sent == true)
			dataUI.sent=0;
		else
			dataUI.sent=1;
	});
	
		
socket.on('disconnect', function(){
console.log('A user disconnected');
	dataUI.sent = 1;
	dataUI.vel = 0;
	});
	});



config();

console.log("done");
setInterval(function(){sendMessage(0,1);},333);

var int = new Gpio(17,'in','rising');

//button.on('interrupt',function(level){
//	console.log("here");
//});

int.watch(isr);

function isr(){
	if(rf_state == 'M_RX')
{		//console.log("recebi");
		ack_received = 1;
		readMessage();
}
	if(rf_state == 'M_TX')
	{
//		console.log("packet_Sent");
	   	writeRegister(0x01,0x04);
		writeRegister(0x25,0x40);
		writeRegister(0x01,0x10);
		packet_sent += 1;
		rf_state='M_RX';
	}
		
}

function config(){
	writeRegister(0x01,0x04);
	setMode('M_STDBY');	
	writeRegister(0x02,0x00);

	writeRegister(0x07,0x6C);
	writeRegister(0x08,0x40);
	writeRegister(0x09,0x00);
	
	writeRegister(0x03,0x02);
	writeRegister(0x04,0x40);
	
	writeRegister(0x05,0x03);
	writeRegister(0x06,0x33);
	
	writeRegister(0x11,0x40|0x20|0x1F);
	writeRegister(0x58,0x2D);
	
	writeRegister(0x19,0x40|0x02);
	
	writeRegister(0x25,0x00);
	writeRegister(0x26,0x07);
	
	writeRegister(0x28,0x10);
	writeRegister(0x29,220);
	
	writeRegister(0x2E,0x80|0x08);
//	console.log(readRegister(0x2e).toString());
	
	 writeRegister(0x2F,0x2D);
   	 writeRegister(0x30,100);
     
   	 writeRegister(0x37, 0x80|0x10);
   	 writeRegister(0x38,64);
    
   	 writeRegister(0x3C,0x01);
	  writeRegister(0x3D,0x02);

	

	
}



function setMode(state){
	//console.log("entrei");
	if(rf_state != state)
	{
		var value = readRegister(0x01);
		value = value & 0xE3;
		
		if(state == 'M_TX'){
			value = 0x0C;
			writeRegister(0x5A,0x5D);
			writeRegister(0x5C,0x70);
//			console.log('TX');
		}	
		else if(state == 'M_RX'){
		//writeRegister(0x01,0x04);
		//writeRegister(0x25,0x40);	

         		value =  0x10;
			writeRegister(0x5A,0x55);
			writeRegister(0x5C,0x70);
//			console.log('M_RX');
		}
		else if(state == 'M_STDBY'){
			value = 0x04;
//			console.log('M_STDY');
		}
		else
			value = value |0x04;
		
		writeRegister(0x01,value);		
//		console.log(parseInt(readRegister(0x01)));
	}
	
//	while(readRegister(0x27)&&0x80 == 0);
	
	rf_state = state;
	//console.log("pssei aqui");
		
	return;
		
}

function  writeRegister(adress, value)
{		var x;
		var message = [{
			sendBuffer: new Buffer([adress|0x80,value]),
			receiveBuffer: new Buffer(2),
			byteLength: 2,
			speedHz:2000000
		}];
		
		
			
			sp.transfer(message,function(err,message){
				if(err) throw err;
			});
	return;
}


function readMessage(){
	setMode('M_STDBY');
	const message = [{
			sendBuffer: Buffer([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]),
			receiveBuffer: Buffer(20),
			byteLength:20,
			speedHz:2000000
			}];
	sp.transfer(message,function(err,msg){
		if(err) throw err;
		io.emit('rcvRF',msg[0].receiveBuffer);
	});
	
	
return
}

function readRegister(address){
		var rt = 0x00;
		const message = [{
			sendBuffer:  Buffer([address&0x7F,0x00]),
			receiveBuffer:  Buffer(2),
			byteLength: 2,
			speedHz:2000000
		}];
		
		sp.transfer(message,function(err,mess){
			if(err) throw err;
		});
		return message[0].receiveBuffer[1];
}



function sendMessage(vel,sent){
//	int.unwatchAll();
	if(ack_received ==0)
	{	
		timeout++;
		if(timeout>30)
		{
			packet_sent = 0;
			packet_received=0;
			timeout = 0;
			console.log("timeout");
		}
	}
	else
		ack_received=0;
	
	
//	io.emit('hey','hello');
	
	setMode('M_STDBY');
	writeRegister(0x25,0x00);
	writeRegister(0x28,0x10);
	var packet_numb = ((packet_sent&0x00FF00) >> 7);
	var packet_numb_lsb = (packet_sent & 0xFF);
	//console.log(dataUI.vel);
		var message = [{
			sendBuffer: new Buffer([0x00|0x80,5,packet_numb,packet_numb_lsb,dataUI.vel,dataUI.sent]),
			receiveBuffer: new Buffer(6),
			byteLength: 6,
			speedHz:2000000
		}];

//		console.log(dataUI.vel);
		sp.transfer(message,function(err,mess){
			if(err) throw err;
		});
		setMode('M_TX');
//		while(int.readSync() == 0);
//		int.watch(isr);	
//
	//	console.log("packet-sent");	
//		setMode('M_STDBY');
//		packet_sent++;
//		writeRegister(0x25,0x40);
//		writeRegister(0x28,0x10);
//		setMode('M_RX');

//		console.log(readRegister(0x28));
	
//		while(int.readSync() == 0);
//		while((readRegister(0x28)&0x04)==0);
//		console.log("recebi");
//		int.watch(isr);
}
