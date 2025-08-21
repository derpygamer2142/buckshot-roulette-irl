import network, socket # type: ignore
from picozero import pico_led # type: ignore
from machine import Pin # type: ignore
import time

SSID="SSID"
PASSWORD="PASSWORD"

targetSwitch = Pin(0, Pin.IN)
targetLED = Pin(2, Pin.OUT)

triggerButton = Pin(15, Pin.IN, value=0)
rackButton = Pin(17, Pin.IN, value=0)

lastTriggerValue = 0 # for detecting changes
lastRackValue = 0    # for detecting changes

startTime = time.time()

class ConnectionManager:
    def __init__(self):
        self.handlers = {}
        self.socket = None
   
        self.packetsIn = []
        self.packetsOut = []
        self.listenerSocket = None
        
    
    def socketAlive(self):
        try:
            self.socket.send("")
            return True
        except Exception as e:
            print("possible dead socket", e)
            return False
        
    
    def connect(self):
        pico_led.on()
        wlan = network.WLAN(network.STA_IF)
        wlan.active(True)
        wlan.connect(SSID, PASSWORD)
            
        # Wait for connect or fail
        max_wait = 10
        while max_wait > 0:
            if wlan.status() < 0 or wlan.status() >= 3:
                break
            max_wait -= 1
            print('waiting for connection...')
            time.sleep(1)

        # Handle connection error
        if wlan.status() != 3:
            raise RuntimeError('network connection failed')
        else:
            print('connected')
            status = wlan.ifconfig()
            print( 'ip = ' + status[0] )
        
        pico_led.off()


    def send(self, req):
        self.packetsOut.append(req)
        print("scheduled packet", req)


    def connectSocket(self, ip):
        success = False

        while not success:
            try:
                print("trying to connect to socket")
                ai = socket.getaddrinfo(ip, 80)
                addr = ai[0][-1]
                s = socket.socket()
                s.connect(addr)
                s.settimeout(0.2)
                s.setblocking(False)

                self.socket = s
                
                success = True
            except OSError as e:
                print("failed to connect, sleeping...", e)
                time.sleep(1)
                print("sleeping finished")

    def addHandler(self, name, func):
        self.handlers[name] = func # func should take data as an argument

    def handle(self, req): # handle a packet
        req = str(req)
        print("Handling request", req)
        req = req.strip()
        data = req.split(" ")

        for i, j in self.handlers.items():
            print("handler", i, "request", data[0]) # the first item in the list of data is the request type
            if (str(i) == str(data[0])):
                print("Found handler for request", data[0])
                j(data[1:]) # freaky af but this passes the request to the handler
                return

        print("Couldn't find handler for", data[0])
        print(self.handlers.keys())


    def main(self):
        global lastTriggerValue, lastRackValue
        addr = socket.getaddrinfo('0.0.0.0', 80)[0][-1]

        s = socket.socket()
        s.bind(addr)
        s.listen(4) # todo: maybe change this number
        s.settimeout(0.2)
        s.setblocking(False) # todo: polling? need to read the documentation

        self.listenerSocket = s

        while True:
            if ((time.time() - startTime) % 2 < 1): pico_led.on()
            else: pico_led.off()

            currentTrigger = triggerButton.value()
            currentRack    = rackButton.value()
            
            if (currentTrigger and (not lastTriggerValue)):
                self.send(f"SHOTGUNFIRE {targetSwitch.value()}") # "SHOTGUNFIRE 0" or "SHOTGUNFIRE 1"
            lastTriggerValue = currentTrigger

            if (currentRack and (not lastRackValue)):
                self.send("SHOTGUNEJECT")
            lastRackValue = currentRack

            targetLED.value(targetSwitch.value())

            # try to accept the connection from the server
            if self.socket == None: 
                try: # the server will be the one to initiate the connection because it's sigma
                     # and we don't want to have the microcontrollers spending all their time trying to make connections
                    out = s.accept()
                    cl, addr = out
                    print('server connected from', addr)
                    self.socket = cl

                except OSError as e:
                    #print("Failed to connect to server")
                    pass

            # check for any new packets if the server is connected
            if self.socket != None:
                if self.socketAlive():
                    try:
                        req = str(self.socket.recv(1024))
                        print("recv from addr ", req, addr)
                        self.packetsIn.append(req)
                    except OSError:
                        #print("No new packets from the server")
                        pass
                else:
                    try: # the server will be the one to initiate the connection because it's sigma
                         # and we don't want to have the microcontrollers spending all their time trying to make connections
                        out = s.accept()
                        cl, addr = out
                        print('server connected from', addr)
                        self.socket = cl

                    except OSError as e:
                        #print("Failed to connect to server")
                        pass
                    
            # check if we have any packets scheduled to be sent to the server, and send them if needed
            if self.socket != None and len(self.packetsOut) > 0:
                print("Sending deferred packet", self.packetsOut[0])
                self.socket.send(self.packetsOut[0])
                self.packetsOut.pop(0)
            
            # check if we have any packets scheduled to be handled, and handle them if needed
            if len(self.packetsIn) > 0:
                self.handle(self.packetsIn[0])
                self.packetsIn.pop(0)

            time.sleep_ms(3)

manager = ConnectionManager()

manager.connect()
# manager.connectSocket("192.168.56.1")

def handler_PING(data):
    print("Received PING from the server")
    manager.send("PONG")

def handler_NONE(data):
    print("Ignoring packet")

manager.addHandler(b"PING", handler_PING)
manager.addHandler(b"PONG", handler_NONE)

try:
    manager.main()
except KeyboardInterrupt:
    manager.listenerSocket.close() # type: ignore
    if (manager.socket != None): manager.socket.close() # type: ignore