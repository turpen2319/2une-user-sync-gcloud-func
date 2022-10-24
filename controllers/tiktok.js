const axios = require('axios').default;
const FormData = require('form-data');
const asyncFs = require('fs/promises');
const fs = require('fs');
const { TranscoderServiceClient } =
require('@google-cloud/video-transcoder').v1;
const { Storage } = require('@google-cloud/storage');
const pathToFfmpeg = require('ffmpeg-static');
const ffmpeg = require("fluent-ffmpeg");
const path = require('path');
// set ffmpeg package path
ffmpeg.setFfmpegPath(pathToFfmpeg);


const PROVIDER = 'oauth_tiktok';
 

module.exports = {
    getVideoList,
    getAccessToken,
    getTikTokUploadParams,
    createJobFromPreset,
    webmToMP4TikTokUpload,
    generateV4UploadSignedUrl,
    fixMP4TikTokUpload,
    listFiles,
    sendFileBuffer,
    getTikTokProfile
}

function listFiles(req, res) {
    fs.readdir(__dirname, (err, files) => {
      if (err) {
        console.error(err);
        res.sendStatus(500);
      } else {
        console.log('Files', files);
        res.sendStatus(200);
      }
    });
};

async function sendFileBuffer(req, res) {
    const bucketID = '2une-video-transcode-bucket';
    const inputTempFileName = `/tmp/transcoded-from-bucket.mp4`;
    
    await downloadFile(bucketID, 'ffmpeg-output/draketest-user_2GHq56b5DOKBqOrMNTnnhECDtwK-1666138618763.webm', inputTempFileName)
    try {
        // const video = await asyncFs
        //     .readFile(inputTempFileName)
        //     .catch(error => console.log("\n\ncan't read file ==> ", error));
        //     // deletefileFromlocalStorage(inputTempFileName);
        //     res.send(video);
        const options = {
            
        };
        res.sendFile(inputTempFileName, options, (error) => {
            if(error) {
                console.log("sendFile not working -->", error)
            } else {
                deletefileFromlocalStorage(inputTempFileName);
                console.log("file sent")
            }
        })
    } catch (error) {
        console.log("couldn't send file buff --> ", error);
        res.json("couldn't send file buff --> ", error);
    }

}

async function uploadVideo(userId, outputTempFileName) {
    // console.log("\n\nMY DATA ----> ", req.body, "-----------------")
 
    const accessToken = await getAccessToken(userId);
    const openId = await getTikTokOpenId(userId);
    console.log({accessToken, openId})

    const endpoint = `https://open-api.tiktok.com/share/video/upload/?access_token=${accessToken}&open_id=${openId}`
    
    const video = await asyncFs.readFile(outputTempFileName).catch(error => console.log("\n\ncan't read file ==> ", error));
    const form = new FormData();
    form.append('video', video, 'fixed.mp4');

    try {
        const uploadResponse = await axios.post(endpoint, form, {
            headers: {
              ...form.getHeaders(),
            },
            maxContentLength: 100000000,
            maxBodyLength: 100000000
        });
        console.log("upload ---> \n\n", uploadResponse.data);
    
        return uploadResponse.data;
        
    } catch (error) {
        console.log("\n\ncouldn't upload --> ", error);
        return error;
    }
    
}

// uploadVideo('user_2G9wmE9mtlFdEmDvokeIUwUOg4V', process.env.HOME + '/Desktop/fix-safari-ios.mp4')

async function getTikTokProfile(userId) {
    const accessToken =  await getAccessToken(userId); 
    const endpoint = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name'

    try {
        const response = await axios({
            method: "GET",
            url: endpoint,
            headers: {
                "Authorization": "Bearer " + accessToken
            }
        })
        console.log("profiel resp --> ", response.data.data.user)
        return response.data.data.user
    } catch (error) {
        console.log("could not get tiktok profile --> ", error);
    }
}


async function getVideoList(userId) {

    const accessToken =  await getAccessToken(userId);
    const endpoint = `https://open-api.tiktok.com/video/list/?access_token=${accessToken}`

    try {
        const response = await axios({
            method: "POST",
            url: endpoint,
            headers: {
                "Content-type": "application/json"
            },
            data: {
                fields: ["id", "embed_link", "title", "embed_html", "height", "width", "cover_image_url"]
            }
        })

        console.log("vid list response --> ", response.data);
        return response.data;
    } catch (error) {
        console.log("tiktok vid list error --> ", error);
        return error;
    }
}

//this will fail if user hasn't logged in...fine in production flow, but 
//make sure to log in the user you're testing with before uploading on their behalf
async function getAccessToken(userId) {
    const endpoint = `https://api.clerk.dev/v1/users/${userId}/oauth_access_tokens/${PROVIDER}` //injection risk?
    
    try {
        const response = await axios({
            method: "GET",
            url: endpoint,
            headers: {
                "Authorization": `Bearer ${process.env.CLERK_API_KEY}`,
                "Content-type": "application/json"
            }

        });

        return response.data[0].token;

    } catch (error) {
        return `\ncould not get access token --> ${error}`;
    }

}

async function getTikTokOpenId(userId) {
    const endpoint = `https://api.clerk.dev/v1/users/${userId}`//for fetching a user by id
    
    try {
        const response = await axios({
            method: "GET",
            url: endpoint,
            headers: {
                "Authorization": `Bearer ${process.env.CLERK_API_KEY}`,
                "Content-type": "application/json"
            }
        });

        const clerkUserObj = response.data;
        let userTikTokOpenId;

        //users might have multiple social accounts linked w/ clerk at some point...so we need to make sure we're finding the openId for the desired provider 
        for(let account of clerkUserObj.external_accounts) {
            if (account.provider === 'oauth_tiktok') {
                userTikTokOpenId = account.provider_user_id;
            }
        }
        
        return userTikTokOpenId;

    } catch (error) {
        console.log("getTikTokOpenId error --> ", error)
        return error;
    }
}

async function getTikTokUploadParams(req, res) {
    const { userId } = req.params;
    try {
        const params = {
            openId: await getTikTokOpenId(userId),
            accessToken: await getAccessToken(userId)
        }
    
        console.log(params);
    
        res.json(params);
        
    } catch (error) {
        res.status(400).json(error);
    }
}

async function createJobFromPreset(req, res) {

    const transcoderServiceClient = new TranscoderServiceClient();
    const projectId = 'music-test-352900';
    const location = 'us-central1';
    const inputUri = 'gs://2une-video-transcode-bucket/transcode-test.webm';
    const outputUri = 'gs://2une-video-transcode-bucket/transcode-output/';
    const preset = 'preset/web-hd';

    // Construct request
    const request = {
        parent: transcoderServiceClient.locationPath(projectId, location),
        job: {
        inputUri: inputUri,
        outputUri: outputUri,
        templateId: preset,
        },
    };

    // Run request
    try {
        const [response] = await transcoderServiceClient.createJob(request);
        console.log(`Job: ${response.name}`);
        res.send(response.name)
    } catch (error) {
        console.log("\n\ncould not create transcode job -->", error)
        res.send(error)
    }
}

// testFixMP4TikTokUpload('draketest-user_2G9wmE9mtlFdEmDvokeIUwUOg4V-1665956676200.webm', 'user_2G9wmE9mtlFdEmDvokeIUwUOg4V')
async function testFixMP4TikTokUpload(objectName, userId) {
    console.log("FIXING MP4 AND UPLOADING TO TIKTOK")

    console.time("time:");
    //download file from bucket into tmp dir
    const bucketID = '2une-video-transcode-bucket';
    const inputTempFileName = `/tmp/broken.webm`;
    const outputTempFileName = `/tmp/fixed.mp4`;

    try {
        const download = await downloadFile(bucketID, objectName, inputTempFileName);
        // ffmpeg(process.env.HOME + "/Desktop/broken.webm")
        console.log("\n\ninput file name --> ",inputTempFileName, "\n\n")
        ffmpeg(inputTempFileName)
            .outputOptions(['-fflags +igndts'])
            .output(outputTempFileName)
            .audioCodec('copy')
            .videoCodec('copy')
            .on("start", (commandLine) => {
                console.log("ffmpeg conversion start: ", commandLine);
            })
            .on("progress", function(progress) {
                console.log("Processing: " + progress.percent + "% done");
            })
            .on("stderr", function(stderrLine) {
                console.log("Stderr output: " + stderrLine);
            })
            .on("codecData", function(data) {
                console.log("Input is " + data.audio + " audio " + "with " + data.video + " video");
            })
            .on("end", async () => {
                console.log("ffmpeg file has been locally converted successfully!...");
                const gsUploadResponse = await uploadFfmpegOutput(outputTempFileName, objectName);
                const tiktokResponse = await uploadVideo(userId, outputTempFileName); 
                deletefileFromlocalStorage(inputTempFileName);
                deletefileFromlocalStorage(outputTempFileName);
                console.timeEnd("time:");
                console.log({tiktokResponse, gsUploadResponse});
            })
            .on('error', (error) => console.log(`something went wrong fixing mp4 ==> \n ${error}`))
            .run(); 

    } catch (error) {
        console.log("could not fix mp4 and upload to tiktok --> ", error)
    }
}

async function fixMP4TikTokUpload(req, res) {
    console.log("FIXING MP4 AND UPLOADING TO TIKTOK")
    const { objectName, userId } = req.body;
    console.time("time:");
    //download file from bucket into tmp dir
    const bucketID = '2une-video-transcode-bucket';
    const inputTempFileName = `/tmp/broken.webm`;
    const outputTempFileName = `/tmp/fixed.mp4`;

    try {
        const download = await downloadFile(bucketID, objectName, inputTempFileName);
        // ffmpeg(process.env.HOME + "/Desktop/broken.webm")
        console.log("\n\ninput file name --> ",inputTempFileName, "\n\n")
        ffmpeg(inputTempFileName)
            .output(outputTempFileName)
            .audioCodec('copy')
            .videoCodec('copy')
            .on("start", (commandLine) => {
                console.log("ffmpeg conversion start: ", commandLine);
            })
            .on("progress", function(progress) {
                console.log("Processing: " + progress.percent + "% done");
            })
            .on("stderr", function(stderrLine) {
                console.log("Stderr output: " + stderrLine);
            })
            .on("codecData", function(data) {
                console.log("Input is " + data.audio + " audio " + "with " + data.video + " video");
            })
            .on("end", async () => {
                console.log("ffmpeg file has been locally converted successfully!...");
                const destFileName = await uploadFfmpegOutput(outputTempFileName, objectName);
                const tiktokResponse = await uploadVideo(userId, outputTempFileName); 
                deletefileFromlocalStorage(inputTempFileName);
                deletefileFromlocalStorage(outputTempFileName);
                console.timeEnd("time:");
                res.json({outputBucketUrl: `https://storage.googleapis.com/${bucketID}/${destFileName}`, tiktokResponse});
            })
            .on('error', (error) => console.log(`something went wrong fixing mp4 ==> \n ${error}`))
            .run(); 

    } catch (error) {
        console.log("could not fix mp4 and upload to tiktok --> ", error)
        res.json("could not fix mp4 and upload to tiktok --> ", error)
    }
}

async function webmToMP4TikTokUpload(req, res) {
    console.log("FIXING WEBM AND UPLOADING TO TIKTOK")
    const { objectName, userId } = req.body
    console.log("hitting webmToMP4")
    console.time("time:");
    //download file from bucket into tmp dir
    const bucketID = '2une-video-transcode-bucket';
    const inputTempFileName = `/tmp/broken.webm`;
    const outputTempFileName = `/tmp/fixed.mp4`;
    
    try {
        const download = await downloadFile(bucketID, objectName, inputTempFileName);
        // ffmpeg(process.env.HOME + "/Desktop/broken.webm")
        console.log("\n\ninput file name --> ",inputTempFileName, "\n\n")
        ffmpeg(inputTempFileName)
            .outputOptions(['-vf pad=ceil(iw/2)*2:ceil(ih/2)*2', '-r 60'])
            .output(outputTempFileName)
            .audioCodec('aac')
            .videoCodec('libx264')
            .on("start", (commandLine) => {
                console.log("ffmpeg conversion start: ", commandLine);
            })
            .on("progress", function(progress) {
                console.log("Processing: " + progress.percent + "% done");
            })
            .on("stderr", function(stderrLine) {
                console.log("Stderr output: " + stderrLine);
            })
            .on("codecData", function(data) {
                console.log("Input is " + data.audio + " audio " + "with " + data.video + " video");
            })
            .on("end", async () => {
                console.log("ffmpeg file has been locally converted successfully!...");
                const destFileName = await uploadFfmpegOutput(outputTempFileName, objectName);
                const tiktokResponse = await uploadVideo(userId, outputTempFileName); 
                deletefileFromlocalStorage(inputTempFileName);
                deletefileFromlocalStorage(outputTempFileName);
                console.timeEnd("time:");
                res.json({outputBucketUrl: `https://storage.googleapis.com/${bucketID}/${destFileName}`, tiktokResponse});
            })
            .on('error', (error) => console.log(`something went wrong ==> \n ${error}`))
            .run();
        

    } catch (error) {
        console.log("something wrong with ffmpeg --> ", error)
        res.json(error)
    }
}

// this function will upload a file to ffmpeg output dir in gs
async function uploadFfmpegOutput(filePath, objectName) {
    const bucketName = '2une-video-transcode-bucket';
    const destFileName = `ffmpeg-output/${objectName}`
    const storage = new Storage();
    const options = {
        destination: destFileName,
        // Optional:
        // Set a generation-match precondition to avoid potential race conditions
        // and data corruptions. The request to upload is aborted if the object's
        // generation number does not match your precondition. For a destination
        // object that does not yet exist, set the ifGenerationMatch precondition to 0
        // If the destination object already exists in your bucket, set instead a
        // generation-match precondition using its generation number.
        // preconditionOpts: {ifGenerationMatch: generationMatchPrecondition},
    };

    try {
        const uploadResponse = await storage.bucket(bucketName).upload(filePath, options);
        console.log("bucket upload response --> ", uploadResponse);
        console.log(`${filePath} uploaded to ${bucketName}`);
        return destFileName;
    } catch (error) {
        console.log("Couldn't upload ffmpeg output -->", error);
    }
}

// this function will delete the locally stored file inside GCF "tmp" folder
function deletefileFromlocalStorage(filename) {
    try {
        // Deletes file from local storage
        fs.unlink(filename, (error) => {
            if (error) {
                console.error(`delete ${filename} file ERROR:`, error);
            } else {
                console.log(`${filename} file deleted.`);
            }
        });
    } catch (error) {
        console.error("fnDeletefilesFromlocalStorage() > ERROR:", error);
    }
}

async function downloadFile(bucketID, gsFileName, inputTempFileName) {
    const storage = new Storage();
    const options = {
        destination: inputTempFileName,
    };

    try {
        await storage.bucket(bucketID).file(gsFileName).download(options);
        console.log("\n\nfile downloaded from bucket to ", inputTempFileName)
    } catch (error) {
        console.log("\n\n\ncould not download file from bucket --> ", error);
        throw error;
    }
}

async function generateV4UploadSignedUrl(req, res) {
    const { userId, gameId } = req.body;

    const objectName = `${gameId}-${userId}-${Date.now()}.webm`;
    // const objectName = 'test-bucket-upload.webm';
    const bucketName = '2une-video-transcode-bucket';

    const storage = new Storage();

    // These options will allow temporary uploading of the file with outgoing
    // Content-Type: application/octet-stream header.
    const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 120 * 60 * 1000, // 120 minutes
        contentType: 'video/webm'
    };

    try {
        // Get a v4 signed URL for uploading file
        const [url] = await storage
            .bucket(bucketName)
            .file(objectName)
            .getSignedUrl(options);    
        
        res.json({signedUrl: url, objectName});
    } catch (error) {
        res.json(error)
    }

}

