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

async function uploadFile(bucketName,datas){
  // Uploads files to bucket
  datas.forEach(fileName => {
    storage
      .bucket(bucketName)
      .upload(fileName, {
        // Support for HTTP requests made with `Accept-Encoding: gzip`
        gzip: true,
        metadata: {
          // Enable long-lived HTTP caching headers
          // Use only if the contents of the file will never change
          // (If the contents will change, use cacheControl: 'no-cache')
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

async function toStorage(bucketName,datas){
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

exports.screenshot = async (req, res) => {
  const url = req.query.url;
  const uuid = uuidv5(url, uuidv5.URL);
  const timestamp = Date.now();
  const img = '/tmp/'+ uuid + '_' + timestamp + '.png';
  const harFile = '/tmp/' + uuid + '_' + timestamp + '.har';

  if (!url) {
    return res.send('Please provide URL as GET parameter, for example: <a href="?url=https://example.com">?url=https://example.com</a>');
  }

  if (!page) {
    page = await getBrowserPage();

  }
  await page.setViewport({
      width: 1920,
      height: 1080
  })
  
  const har = new PuppeteerHar(page);
  await har.start({ path: harFile });

  await page.goto(url);
  const performanceTiming = JSON.parse(
    await page.evaluate(() => JSON.stringify(window.performance.timing))
  )
  await har.stop();
  await page.screenshot({
    path: img,
    fullPage: true
  })

  toStorage(uuid, [harFile,img]);
  
  res.send(performanceTiming);
  //res.send(data);  
};