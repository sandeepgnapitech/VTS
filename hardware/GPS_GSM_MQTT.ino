/*
 * GNAPI GPS Tracker Firmware
 * Libraries: ESP32, TinyGPS++, PubSubClient, ArduinoJson
 */

 #include <WiFi.h>
 #include <WebServer.h>
 #include <DNSServer.h>
 #include <EEPROM.h>
 #include <PubSubClient.h>
 #include <TinyGPS++.h>
 #include <HardwareSerial.h>
 #include <ArduinoJson.h>
 
 // EEPROM size
 #define EEPROM_SIZE 1024
 
 // DNS Server for captive portal
 const byte DNS_PORT = 53;
 DNSServer dnsServer;
 
 // WiFi and GSM credentials structure
 struct {
   char ssid[32];
   char pass[64];
   char deviceId[37]; // UUID format: 8-4-4-4-12
   char gsmApn[32];
   char gsmUser[32];
   char gsmPass[32];
 } credentials;
 
 // Pin definitions
 #define GPS_RX 16
 #define GPS_TX 17
 #define GPS_BAUD 9600
 
 // MQ-3 Alcohol Sensor pin
 #define MQ3_PIN 34  // Analog pin for MQ-3
 #define MQ3_SAMPLES 10  // Number of samples for averaging
 #define MQ3_SAMPLE_INTERVAL 100  // Time between samples in ms
 
 // MQ-3 calibration values
 const float MQ3_RL = 200;    // Load resistance in kOhm
 const float MQ3_R0 = 10;     // Sensor resistance in clean air
 
 // GSM Serial pins  
 #define GSM_RX 4
 #define GSM_TX 2
 #define GSM_BAUD 115200
 
 // MQTT Settings
 const char* mqtt_server = "test.mosquitto.org";
 const int mqtt_port = 1883;
 const char* mqtt_topic_prefix = "device/";
 const char* mqtt_topic_suffix = "/data";
 
 // Object initialization
 TinyGPSPlus gps;
 HardwareSerial GPSSerial(1); // UART1 for GPS
 HardwareSerial GSMSerial(2); // UART2 for GSM
 WiFiClient espClient;
 PubSubClient client(espClient);
 WebServer server(80);
 
 // Variables
 bool isWiFiConnected = false;
 bool isGSMConnected = false;
 bool isAPMode = false;
 unsigned long lastPublish = 0;
 const int publishInterval = 10000; // 10 seconds
 
 // Initialize hardware
// Handle serial commands
void handleSerialCommand(String command) {
  command.trim();
  
  if (command == "help" || command == "?") {
    Serial.println("\n=== Available Commands ===");
    Serial.println("help or ? - Show this help message");
    Serial.println("clear     - Clear EEPROM and reset device");
    Serial.println("status    - Show detailed device status including:");
    Serial.println("           * Connection status (WiFi/GSM)");
    Serial.println("           * EEPROM configuration");
    Serial.println("           * GPS location and quality");
    Serial.println("           * MQ3 alcohol sensor readings");
    Serial.println("           * MQTT connection details");
  }
  else if (command == "clear") {
    Serial.println("Clearing EEPROM...");
    for (int i = 0; i < EEPROM_SIZE; i++) {
      EEPROM.write(i, 0);
    }
    if (EEPROM.commit()) {
      Serial.println("EEPROM cleared successfully. Restarting device...");
      delay(1000);
      ESP.restart();
    } else {
      Serial.println("Failed to clear EEPROM!");
    }
  }
  else if (command == "status") {
    Serial.println("\n=== Device Status ===");
    
    // Connection Status
    Serial.println("\n-- Connection Status --");
    Serial.println("WiFi: " + String(isWiFiConnected ? "Connected" : "Disconnected"));
    if (isWiFiConnected) {
      Serial.println("WiFi SSID: " + String(WiFi.SSID()));
      Serial.println("WiFi IP: " + WiFi.localIP().toString());
      Serial.println("WiFi Signal Strength: " + String(WiFi.RSSI()) + " dBm");
    }
    Serial.println("GSM: " + String(isGSMConnected ? "Connected" : "Disconnected"));
    
    // EEPROM Values
    Serial.println("\n-- Stored Configuration --");
    Serial.println("Device ID: " + String(credentials.deviceId));
    Serial.println("WiFi SSID: " + String(credentials.ssid));
    Serial.println("GSM APN: " + String(credentials.gsmApn));
    Serial.println("GSM User: " + String(credentials.gsmUser));
    
    // GPS Status
    Serial.println("\n-- GPS Status --");
    if (gps.location.isValid()) {
      Serial.println("Fix Status: Valid Fix");
      Serial.println("Location: " + 
        String(gps.location.lat(), 6) + ", " + 
        String(gps.location.lng(), 6));
      Serial.println("Altitude: " + String(gps.altitude.meters()) + "m");
      Serial.println("Speed: " + String(gps.speed.kmph()) + " km/h");
      Serial.println("Satellites: " + String(gps.satellites.value()));
      Serial.println("HDOP: " + String(gps.hdop.value()));
    } else {
      Serial.println("Fix Status: No Fix");
      Serial.println("Satellites visible: " + String(gps.satellites.value()));
    }
    
    // MQ3 Sensor
    Serial.println("\n-- MQ3 Alcohol Sensor --");
    float alcoholLevel = 0;
    for (int i = 0; i < MQ3_SAMPLES; i++) {
      alcoholLevel += analogRead(MQ3_PIN);
      delay(MQ3_SAMPLE_INTERVAL / MQ3_SAMPLES);
    }
    alcoholLevel /= MQ3_SAMPLES;
    float alcoholMgL = alcoholLevel * (3.3 / 4095.0);
    Serial.println("Raw Value: " + String(alcoholLevel));
    Serial.println("Alcohol Level: " + String(alcoholMgL) + " mg/L");
    
    // MQTT Status
    Serial.println("\n-- MQTT Status --");
    Serial.println("Broker: " + String(mqtt_server) + ":" + String(mqtt_port));
    Serial.println("Topic: " + String(mqtt_topic_prefix) + String(credentials.deviceId) + String(mqtt_topic_suffix));
    Serial.println("Connected: " + String(client.connected() ? "Yes" : "No"));
  }
}

void setup() {
   Serial.begin(115200);
   delay(1000);
   Serial.println("\n=== GNAPI GPS Tracker Starting ===");
   Serial.println("Type 'help' or '?' for available commands");
   
   if (!EEPROM.begin(EEPROM_SIZE)) {
     Serial.println("Failed to initialize EEPROM!");
     delay(1000);
     ESP.restart();
   }
   
   pinMode(MQ3_PIN, INPUT);
   
   if (isFirstBoot() || !loadCredentials()) {
     Serial.println("No valid credentials - Starting AP mode");
     setupAP();
   } else {
     // Initialize peripherals
     GPSSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX, GPS_TX);
     GSMSerial.begin(GSM_BAUD, SERIAL_8N1, GSM_RX, GSM_TX);
     
     // Setup networking
     WiFi.persistent(true);  // Save WiFi credentials in flash
     WiFi.setAutoReconnect(true);  // Enable auto-reconnect
     
     // Try WiFi connection with multiple attempts
     bool connected = false;
     for (int i = 0; i < 3 && !connected; i++) {  // Try 3 times
       if (i > 0) {
         Serial.printf("\nRetrying WiFi connection (attempt %d/3)...\n", i + 1);
         delay(1000);  // Wait between attempts
       }
       connected = connectWiFi();
     }
     
     if (!connected) {
       Serial.println("\nAll WiFi connection attempts failed");
       Serial.println("Switching to GSM mode...");
       setupGSM();
     }
     
     // Setup MQTT
     client.setServer(mqtt_server, mqtt_port);
     client.setKeepAlive(60);  // Keep connection alive for 60 seconds
   }
   
   Serial.println("\nSetup complete!");
 }
 
 // Main loop
void loop() {
   if (Serial.available()) {
     String command = Serial.readStringUntil('\n');
     handleSerialCommand(command);
   }
   
   if (isAPMode) {
     dnsServer.processNextRequest();
     server.handleClient();
   } else {
     handleGPS();
     handleConnections();
   }
}
 
 // Configuration web page handler
 void handleRoot() {
   String html = "<html><head><title>GPS Tracker Setup</title>";
   html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
   html += "<style>";
   html += "body{font-family:Arial;margin:20px;max-width:400px;margin:0 auto;padding:20px;background:#f5f5f5}";
   html += ".card{background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}";
   html += "input{width:100%;padding:8px;margin:8px 0;box-sizing:border-box;border:1px solid #ddd;border-radius:4px}";
   html += "input:focus{outline:none;border-color:#4CAF50}";
   html += "button.primary{background:#4CAF50;color:white;padding:12px;border:none;width:100%;margin-top:15px;border-radius:4px;cursor:pointer}";
   html += "button.primary:hover{background:#45a049}";
   html += "button.reset{background:#dc3545;color:white;padding:8px 16px;border:none;border-radius:4px;cursor:pointer;margin-top:20px;font-size:0.9em}";
   html += "button.reset:hover{background:#c82333}";
   html += ".section{margin-bottom:20px;padding:15px;background:#f9f9f9;border-radius:4px}";
   html += "h2{color:#333;margin-bottom:25px;text-align:center}";
   html += ".help-text{color:#666;font-size:0.9em;margin-top:4px}";
   html += "</style></head>";
   html += "<body><div class='card'>";
   html += "<h2>GPS Tracker Setup</h2>";
   html += "<form method='POST' action='/save' onsubmit='return validateForm()'>";
   html += "<div class='section'><b>WiFi Settings</b><br>";
   html += "SSID:<br><input type='text' name='ssid' required><br>";
   html += "Password:<br><input type='password' name='password'><br></div>";
   html += "<div class='section'><b>Device Settings</b><br>";
   html += "Device ID (UUID):<br><input type='text' name='deviceId' ";
   html += "pattern='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' ";
   html += "title='Please enter a valid UUID' required></div>";
   html += "<div class='section'><b>GSM Settings</b><br>";
   html += "<p class='help-text'>Contact your mobile provider for APN details</p>";
   html += "APN:<br><input type='text' name='gsmApn' required><br>";
   html += "Username (optional):<br><input type='text' name='gsmUser'><br>";
   html += "Password (optional):<br><input type='password' name='gsmPass'></div>";
   html += "<button type='submit' class='primary'>Save Configuration</button>";
   html += "</form>";
   html += "<div style='text-align:center;margin-top:20px'>";
   html += "<button onclick='resetDevice()' class='reset'>Factory Reset</button>";
   html += "</div>";
   html += "<script>";
   html += "function resetDevice() {";
   html += "  if (confirm('Are you sure you want to reset the device? All settings will be cleared.')) {";
   html += "    fetch('/reset', { method: 'POST' })";
   html += "      .then(response => {";
   html += "        if(!response.ok) throw new Error('Failed to reset device');";
   html += "        alert('Device reset successful. The device will restart.');";
   html += "        setTimeout(() => { window.location.reload(); }, 2000);";
   html += "      })";
   html += "      .catch(error => alert('Reset failed: ' + error));";
   html += "  }";
   html += "}";
   html += "function validateForm() {";
   html += "  var ssid = document.querySelector('[name=ssid]').value;";
   html += "  var deviceId = document.querySelector('[name=deviceId]').value;";
   html += "  var apn = document.querySelector('[name=gsmApn]').value;";
   html += "  var uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;";
   html += "  if (!ssid) {";
   html += "    alert('Please enter WiFi SSID');";
   html += "    return false;";
   html += "  }";
   html += "  if (!uuidPattern.test(deviceId)) {";
   html += "    alert('Please enter a valid Device ID in UUID format');";
   html += "    return false;";
   html += "  }";
   html += "  if (!apn) {";
   html += "    alert('Please enter GSM APN');";
   html += "    return false;";
   html += "  }";
   html += "  return true;";
   html += "}";
   html += "document.querySelector('[name=deviceId]').addEventListener('focus', function(){";
   html += "  if (!this.value) {";
   html += "    this.value = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,";
   html += "      function(c) {";
   html += "        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);";
   html += "        return v.toString(16);";
   html += "      });";
   html += "  }";
   html += "});";
   html += "</script>";
   html += "</body></html>";
   server.send(200, "text/html", html);
 }
 
 // Check if this is first boot
 bool isFirstBoot() {
   byte marker;
   EEPROM.get(EEPROM_SIZE - 1, marker);
   return marker != 0xAA;
 }
 
 // Initialize AP mode for configuration
 void setupAP() {
   WiFi.disconnect();
   WiFi.mode(WIFI_AP);
   
   String apName = "GNAPI-Tracker-" + String((uint32_t)ESP.getEfuseMac(), HEX);
   if (WiFi.softAP(apName.c_str(), "password123")) {
     Serial.println("AP Created: " + apName);
     Serial.println("Password: password123");
     Serial.println("IP: " + WiFi.softAPIP().toString());
     
     dnsServer.start(DNS_PORT, "*", WiFi.softAPIP());
     
     server.on("/", HTTP_GET, handleRoot);
     server.on("/save", HTTP_POST, handleSave);
     server.on("/reset", HTTP_POST, handleReset);
     server.onNotFound(handleNotFound);
     server.begin();
     
     isAPMode = true;
   }
 }
 
 // Save user configuration
 void handleSave() {
   if (!server.hasArg("ssid") || !server.hasArg("deviceId") || !server.hasArg("gsmApn")) {
     server.send(400, "text/plain", "Missing required fields");
     return;
   }
 
   strncpy(credentials.ssid, server.arg("ssid").c_str(), sizeof(credentials.ssid) - 1);
   strncpy(credentials.pass, server.arg("password").c_str(), sizeof(credentials.pass) - 1);
   strncpy(credentials.deviceId, server.arg("deviceId").c_str(), sizeof(credentials.deviceId) - 1);
   strncpy(credentials.gsmApn, server.arg("gsmApn").c_str(), sizeof(credentials.gsmApn) - 1);
   strncpy(credentials.gsmUser, server.arg("gsmUser").c_str(), sizeof(credentials.gsmUser) - 1);
   strncpy(credentials.gsmPass, server.arg("gsmPass").c_str(), sizeof(credentials.gsmPass) - 1);
 
   EEPROM.put(0, credentials);
   EEPROM.write(EEPROM_SIZE - 1, 0xAA);
   if (EEPROM.commit()) {
     server.send(200, "text/plain", "Configuration saved. Device will restart...");
     delay(1000);
     ESP.restart();
   } else {
     server.send(500, "text/plain", "Failed to save configuration");
   }
 }
 
 // Factory reset handler
 void handleReset() {
   for (int i = 0; i < EEPROM_SIZE; i++) {
     EEPROM.write(i, 0);
   }
   EEPROM.commit();
   server.send(200, "text/plain", "Device reset successful. Restarting...");
   delay(1000);
   ESP.restart();
 }
 
 // Captive portal handler
 void handleNotFound() {
   if (isAPMode) {
     String url = "http://" + WiFi.softAPIP().toString();
     server.sendHeader("Location", url, true);
     server.send(302, "text/plain", "");
   } else {
     server.send(404, "text/plain", "Not found");
   }
 }
 
 // Load saved configuration
 bool loadCredentials() {
   EEPROM.get(0, credentials);
   return strlen(credentials.ssid) > 0 && strlen(credentials.deviceId) > 0;
 }
 
 // Connect to WiFi
 bool connectWiFi() {
   Serial.print("Connecting to WiFi SSID: ");
   Serial.println(credentials.ssid);
   
   WiFi.mode(WIFI_STA);
   WiFi.disconnect();
   delay(100);
   
   WiFi.begin(credentials.ssid, credentials.pass);
   int attempts = 20;
   
   while (WiFi.status() != WL_CONNECTED && attempts--) {
     delay(500);
     Serial.print(".");
   }
   Serial.println();
   
   isWiFiConnected = (WiFi.status() == WL_CONNECTED);
   
   if (isWiFiConnected) {
     Serial.print("Connected! IP address: ");
     Serial.println(WiFi.localIP());
   } else {
     Serial.println("Failed to connect to WiFi");
   }
   
   return isWiFiConnected;
 }
 
 // Setup GSM connection
 void setupGSM() {
   sendATCommand("AT", 1000);
   sendATCommand("AT+CGATT=1", 1000);
   String apnCmd = "AT+CSTT=\"" + String(credentials.gsmApn) + "\"";
   if (strlen(credentials.gsmUser) > 0) {
     apnCmd += ",\"" + String(credentials.gsmUser) + "\"";
     if (strlen(credentials.gsmPass) > 0) {
       apnCmd += ",\"" + String(credentials.gsmPass) + "\"";
     }
   }
   sendATCommand(apnCmd.c_str(), 1000);
   sendATCommand("AT+CIICR", 3000);
   isGSMConnected = true;
 }
 
 // Send AT command to GSM module
 String sendATCommand(const char* cmd, int timeout) {
   GSMSerial.println(cmd);
   String response = "";
   long start = millis();
   while (millis() - start < timeout) {
     if (GSMSerial.available()) {
       response += (char)GSMSerial.read();
     }
   }
   return response;
 }
 
 // Process GPS data
 void handleGPS() {
   while (GPSSerial.available()) {
     if (gps.encode(GPSSerial.read()) && 
         gps.location.isValid() && 
         millis() - lastPublish > publishInterval) {
       publishData();
       lastPublish = millis();
     }
   }
 }
 
 // Handle connection state
 void handleConnections() {
   if (WiFi.status() == WL_CONNECTED) {
     if (!isWiFiConnected) {
       isWiFiConnected = true;
       isGSMConnected = false;
     }
     if (!client.connected()) {
       String clientId = "GNAPI-" + String(credentials.deviceId);
       client.connect(clientId.c_str());
     }
     client.loop();
   } else if (isWiFiConnected) {
     Serial.println("WiFi connection lost");
     isWiFiConnected = false;
     if (!connectWiFi()) { // Try to reconnect to WiFi first
       Serial.println("WiFi reconnection failed, switching to GSM");
       setupGSM();
     }
   }
 }
 
 // Publish sensor data
 void publishData() {
   StaticJsonDocument<200> doc;
   doc["device_id"] = credentials.deviceId;
   doc["latitude"] = gps.location.lat();
   doc["longitude"] = gps.location.lng();
   doc["speed"] = gps.speed.kmph();
   doc["satellites"] = gps.satellites.value();
   doc["connection"] = isWiFiConnected ? "WiFi" : "GSM";
   
   float alcoholLevel = 0;
   for (int i = 0; i < MQ3_SAMPLES; i++) {
     alcoholLevel += analogRead(MQ3_PIN);
     delay(MQ3_SAMPLE_INTERVAL / MQ3_SAMPLES);
   }
   alcoholLevel /= MQ3_SAMPLES;
   doc["alcohol_mg_l"] = alcoholLevel * (3.3 / 4095.0);
   
   char jsonBuffer[200];
   serializeJson(doc, jsonBuffer);
   
   if (isWiFiConnected) {
     client.publish((String(mqtt_topic_prefix) + credentials.deviceId + mqtt_topic_suffix).c_str(), jsonBuffer);
   } else if (isGSMConnected) {
     // Implementation for GSM MQTT publish
   }
 }
