// Imports the Google Cloud client library
const {Storage} = require('@google-cloud/storage');
const puppeteer = require('puppeteer');
const PuppeteerHar = require('puppeteer-har');
const uuidv5 = require('uuid/v5');

// Creates a client
const storage = new Storage();
var bucketsList = [];

let page;

async function getBrowserPage() {
  // Launch headless Chrome. Turn off sandbox so Chrome can run under root.
  const browser = await puppeteer.launch({args: ['--no-sandbox']});
  return browser.newPage();
}

//Google Storage upload function
async function uploadFile(bucketName,datas){
  // Uploads files to bucket
  datas.forEach(fileName => {
    storage
      .bucket(bucketName)
      .upload(fileName, {
        gzip: true,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      })
      .then(() => {
        console.log(`${fileName} uploaded to ${bucketName}.`);
      })
      .catch(err => {
        console.error('ERROR:', err);
      });    
  });  
} 

//Google Storage check buckets function
function toStorage(bucketsList,bucketName,datas){
  //List buckets
  storage
    .getBuckets()
    .then(() => {
      //Check if bucket don't exist then create it
      if (bucketsList.indexOf(bucketName) == -1){
        storage
        .createBucket(bucketName)
        .then(() => {
          console.log(`Bucket ${bucketName} created.`);
          uploadFile(bucketName,datas); 
        })
        .catch(err => {
          console.error('ERROR:', err);
        });       
      }
      else{
        //Bucket exist then upload data
        console.log(`Bucket ${bucketName} already exist.`);
        uploadFile(bucketName,datas);
      }
    })
    .catch(err => {
      console.error('ERROR:', err);
    });
}

//Google Storage list buckets
function listBuckets(){
  //List buckets
  storage
    .getBuckets()
    .then(results => {
      const buckets = results[0];
      
      //List all buckets
      console.log('Buckets:');
      buckets.forEach(bucket => {
        console.log(bucket.name);
        bucketsList.push(bucket.name);
      });
      return bucketsList;
    })
    .catch(err => {
      console.error('ERROR:', err);
    });
}

//Google Cloud Functions Webcheck
exports.webcheck = async (req, res) => {
  //Get buckets list
  bucketsList = listBuckets();
  //Get URL to test
  const url = req.query.url;
  //Generate an UUID for the url
  const uuid = uuidv5(url, uuidv5.URL);
  //Generate a timestamp
  const timestamp = Date.now();
  //Declare the path where to store the screenshot and HAR files.
  const img = '/tmp/'+ uuid + '_' + timestamp + '.png';
  const harFile = '/tmp/' + uuid + '_' + timestamp + '.har';

  //Check if the url parameter is set
  if (!url) {
    return res.send('Please provide URL as GET parameter, for example: <a href="?url=https://example.com">?url=https://example.com</a>');
  }
  if (!page) {
    page = await getBrowserPage();

  }

  //Define the resolution screen to simulate
  await page.setViewport({
      width: 1920,
      height: 1080
  })
  
  //Start HAR trace
  const har = new PuppeteerHar(page);
  await har.start({ path: harFile });

  //Start navigation
  await page.goto(url);
  const performanceTiming = JSON.parse(
    await page.evaluate(() => JSON.stringify(window.performance.timing))
  )
  
  //Stop HAR trace
  await har.stop();

  //Take a screenshot
  await page.screenshot({
    path: img
  })

  //Upload data to Google Cloud Storage
  toStorage(bucketsList, uuid, [harFile,img]);
  
  //Send performance timing to the client
  res.send(performanceTiming);  
};