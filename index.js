
	var spi = require('spi-device'), // biblioteca SPI
	  sp;
	var express = require('express'); // biblioteca EXPRESS
	var io = require('socket.io'); // biblioteca SOCKET.io
	var Gpio = require('onoff').Gpio // Biblioteca para as interrupções.
	//var Gpio = require('pigpio').Gpio
	var rf_state = 'M_STDBY';  // Estado inicial do módulo RF
	var ack_received  = 0;
	var packet_received = 0;
	var packet_sent = 0;
	var timeout = 0;




	sp = spi.openSync(0, 1, function (err) {
	  if (err) throw err;
	  // An SPI message is an array of one or more read+write transfer
	});

	var dataUI = { vel : 0,sent : 1}; // Classe para enviar -- Velocidade prentendida e o sentido pretendido

	var app = express();

	app.use(express.static(__dirname +'/public')) // Buscar o sketch na pasta public

	app.get('/',function(req,res,next){
	res.sendFile(__dirname + 'index.html'); // pasta public - onde está presente o ficheiro html que apresenta o esquema da página.
	});

	var server = app.listen(3000); // criar o server na porta 3000
	var socket = require('socket.io'); // biblioteca socket.io
	var io = socket(server); //associar os sockets ao server criado

	io.on('connection', function(socket,packet_sent){ // Apenas a informção que um utilizador se conectou ao server
			console.log('user connected');
			/*setInterval(function(){
				socket.emit('hey',Sent a message 4 seconds after connection');
			},400);
			
			*/
		socket.on('carstate',function(data){ // colocar o estado inicial
			dataUI.vel=data.speed;
					
			if(data.sent == true)
				dataUI.sent=0;
			else
				dataUI.sent=1;
		});
		
			
	socket.on('disconnect', function(){ // quando o utilizador se desconecta colocar a velocidade pretendida para 0.
	console.log('A user disconnected');
		dataUI.sent = 1;
		dataUI.vel = 0;
		});
		});



	config(); // configuração do módulo RF

	setInterval(function(){sendMessage(0,1);},333); // Função periodica de envio de mensagens

	var int = new Gpio(17,'in','rising'); // interrupção no pin 17.

	//button.on('interrupt',function(level){
	//	console.log("here");
	//});

	int.watch(isr);

	function isr(){ // interrupção
		if(rf_state == 'M_RX')
	{		//console.log("recebi");
			ack_received = 1;
			readMessage();
	}
		if(rf_state == 'M_TX')
		{
	//		console.log("packet_Sent");
		   	writeRegister(0x01,0x04); // set mode stfby
			writeRegister(0x25,0x40); // interrupção
			writeRegister(0x01,0x10); //set modo RX
			packet_sent += 1; // sem efeito so para um estudo.
			rf_state='M_RX';
		}
			
	}

	function config(){ // configuração do módulo RF igual ao ROVER CODE.
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



	function setMode(state){ // mudança de estado do módulo RF
		
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

		}
		

		
		rf_state = state;

			
		return;
			
	}

	function  writeRegister(adress, value) // escrita no módulo RF
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


	function readMessage(){ //recepção de um pacote
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

	function readRegister(address){ // Escrita em um registo
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



	function sendMessage(vel,sent){ // função períodica de 333ms
	//	int.unwatchAll();
		if(ack_received ==0)
		{	
			timeout++;
			if(timeout>30)
			{
				packet_sent = 0;
				packet_received=0;
				timeout = 0;
				console.log("timeout"); // timeoutr apos 30 mensagens enviadas sem sucesso
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

	}
