const mqtt = require('mqtt')
const client  = mqtt.connect('mqtt://broker.mqttdashboard.com')
const crypto = require('crypto');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const creds = require('./splinterlands-bot-355900-ef57de37996e.json'); // the file saved above
const doc = new GoogleSpreadsheet('10Xip5sqF2gNL1ixcSFdKk0qccYAvV3e366-C9jMsNB4');
const CronJob = require('cron').CronJob;

const algorithm = 'aes-256-ctr';
const secretKey = '7fd38120006b40d2aa863ad17015935f';
const client_version = '1.0.2'

var sheet = null
var rows = null


const updateLicense = async () =>{
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo()
    // console.log(doc.title);
    sheet = doc.sheetsByIndex[0]
    rows = await sheet.getRows();
    console.log('license updated')
}

const encrypt = (text) => {
    
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex')
    };
};

const decrypt = (hash) => {

    const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(hash.iv, 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);

    return decrpyted.toString();
};


client.on('connect', function () {
  client.subscribe('splinterlands/nemesis/request/#', async function (err) {
    if (!err) {
        var data = {
            account: 'demo'
        }
        await updateLicense()
      client.publish('splinterlands/nemesis/request/max_account/demo', JSON.stringify(encrypt(JSON.stringify(data))))
    }
  })
})

client.on('message', async function (topic, message) {
    if (topic.indexOf('splinterlands/nemesis/request/max_account') > -1){
        // message is Buffer
        var message = JSON.parse(decrypt(JSON.parse(message.toString())))
        // console.log(message)
        var dateNow = new Date()
        var timeOffSet = -7*60*60*1000
        for (var i = 0; i < rows.length; i++){
            // console.log(rows[i]['_rawData'], (new Date(rows[i]['_rawData'][1])).getTime(), message.account, message.account == rows[i]['_rawData'][0], dateNow.getTime() , (new Date(rows[i]['_rawData'][1])).getTime()+timeOffSet)
            if (message.account == rows[i]['_rawData'][0]){
                var data = {}
                if (dateNow.getTime() < (new Date(rows[i]['_rawData'][1])).getTime()+timeOffSet){
                    data = {
                        max_account: Number(rows[i]['_rawData'][2]),
                        valid_until: rows[i]['_rawData'][1],
                        fee_rate: Number(rows[i]['_rawData'][4]),
                        client_version: client_version
                    }
                }else{
                    data = {
                        max_account: 0,
                        valid_until: rows[i]['_rawData'][1],
                        fee_rate: 30,
                        client_version: client_version
                    }
                }
                console.log(message, data)
                client.publish('splinterlands/nemesis/response/max_account/'+message.account, JSON.stringify(encrypt(JSON.stringify(data))))
                rows[i].latest_login = dateNow.toLocaleString()
                rows[1].save()
            }
        }
    }
})

const jobUpdateLicenses =  new CronJob('*/15 * * * *', function(){
    updateLicense()
}, null, true);