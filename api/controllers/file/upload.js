module.exports = {

  friendlyName: 'Upload',
  description: 'Upload file.',

  inputs: {

    type: {
      type: 'string',
      // required: true,
      isIn: ['profile', 'services', 'community'],
      defaultsTo: 'profile',
    }

  },

  exits: {

    sucess: {
      description: 'All done',
    },

    invalid: {
      description: 'Invalid',
    },

    errorRequest: {
      description: 'Error request',
    }

  },


  fn: async function (inputs, exits) {

    sails.log('upload to gcp.....')
    try {
      // // var loggedInUser = this.req.authUser;
      // var loggedInUser = this.req.me;
      // if (!loggedInUser) {
      //   return this.res.unauthorized();
      // }
      const uuid = require('uuid');
      var loggedInUser = {
        id: 5,
        userUuid: uuid.v4(),
      }

      var path = require('path');
      var fs = require('fs')
      const { Storage } = require('@google-cloud/storage');
  
      var cloudStorageKeys = sails.config.custom.googleCloudStorageKey;
      var bucketName = sails.config.custom.googleCloudStorageBucketName;
  
      const storage = new Storage({ credentials: cloudStorageKeys })

      sails.log('path: ', path)
      sails.log('fs: ', fs)
      sails.log('Storage: ', Storage)
      sails.log('cloudStorageKeys: ', cloudStorageKeys)
      sails.log('bucketName: ', bucketName)
      sails.log('storage: ', storage)
  
      var photoType = ['profile', 'services', 'community'];
  
      if (!photoType.includes(inputs.type)) {
          return exits.invalid({
              errors: [{
                  code: sails.config.custom.errorCodes.invaliUploadType.code,
                  message: sails.config.custom.errorCodes.invaliUploadType.message
              }]
          })
      }
      var supportedFileFormat = ['image/jpeg', 'image/png']
      var fileType = this.req.file('file')._files[0].stream.headers['content-type'];
      if (!supportedFileFormat.includes(fileType)) {
          return exits.invalid({
              errors: [{
                  code: sails.config.custom.errorCodes.invalidImageFormat.code,
                  message: sails.config.custom.errorCodes.invalidImageFormat.message
              }]
          })
      }
  
      switch(inputs.type) {
        case 'services':
          folderName = `services/${loggedInUser.userUuid}/`;
          break;
        case 'community':
          folderName = `community/${loggedInUser.userUuid}/`;
          break;
        default:
          folderName = `profiles/${loggedInUser.userUuid}/`;
      }
  
  
      const directoryName = `${folderName}`;
      await this.req.file('file').upload(async function (err, uploadedFile) {
          if (err) {
              sails.log.error("Upload Image error:", err)
              return exits.errorRequest();
          }
          var localFileDir = uploadedFile[0].fd;
  
          await storage.bucket(bucketName).upload(localFileDir, {
              destination: directoryName + path.basename(uploadedFile[0].fd) //Setting up the directory name for the file.
              // And while we are at it, let's monitor the progress of this upload
              , onUploadProgress: progress => sails.log.verbose('Upload progress:', progress)
          }, async (error, file) => {
              if (error) {
                  sails.log.error("Upload Image to cloud storage:", error);
                  //remove file from .tmp directory
                  await fs.unlink(localFileDir, (err) => {
                      if (err) {
                          sails.log.error("remove uploaded file from ./tmp error:",err)
                      }
                  })
                  return exits.errorRequest();
              } else {
                  //remove file from .tmp directory
                  await fs.unlink(localFileDir, (err) => {
                      if (err) {
                          sails.log.error("remove uploaded file from ./tmp error:",err)
                      }
                  })
  
  
  
                  if (inputs.type == 'profile') {
                      var userProfile = await UserProfile.findOne({ userId: loggedInUser.id });
                      if (!userProfile) {
                          await UserProfile.create({ profilePicture: file.metadata.name })
                      } else {
                          await UserProfile.update({ userId: loggedInUser.id }).set({ profilePicture: file.metadata.name })
                      }
  
                      const options = {
                          version: 'v2', // defaults to 'v2' if missing.
                          action: 'read',
                          expires: Date.now() + 1000 * 60 * 60 * 2, // two hour
                      };
  
                      // Get a v2 signed URL for the file
                      const [url] = await storage.bucket(bucketName).file(file.metadata.name).getSignedUrl(options);
                      return exits.success({ imageUrl: url })
                  } else if(inputs.type == 'services') {
                      var userServiceImage = await UserServiceImage.create({ imageUrl: file.metadata.name, userId: loggedInUser.id }).fetch()
  
                      const options = {
                          version: 'v2', // defaults to 'v2' if missing.
                          action: 'read',
                          expires: Date.now() + 1000 * 60 * 60 * 2, // two hour
                      };
  
                      // Get a v2 signed URL for the file
                      const [url] = await storage.bucket(bucketName).file(file.metadata.name).getSignedUrl(options);
                      return exits.success({ imageId: userServiceImage.id, imageUrl: url })
                  } else {
                    var userCommunityImage = await UserCommunityImage.create({ imageUrl: file.metadata.name, userId: loggedInUser.id }).fetch()
  
                      const options = {
                          version: 'v2', // defaults to 'v2' if missing.
                          action: 'read',
                          expires: Date.now() + 1000 * 60 * 60 * 2, // two hour
                      };
  
                      // Get a v2 signed URL for the file
                      const [url] = await storage.bucket(bucketName).file(file.metadata.name).getSignedUrl(options);
                      return exits.success({ imageId: userCommunityImage.id, imageUrl: url })
                  }
              }
          })
      });
  
    } catch (error) {
        sails.log.error('Upload pictures error:', error)
        return exits.errorRequest()
    }

  }

};
