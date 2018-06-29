var request = require('request');
var TOKEN = process.env.CLUBHOUSE_API_TOKEN;

module.exports = {
    fetchProjects: function(callback) {
        request({
            url: 'https://api.clubhouse.io/api/beta/projects?token=' + TOKEN,
            json: true
        }, callback);
    },

    fetchStories: function(projectID, callback) {
        request({
            url: 'https://api.clubhouse.io/api/beta/stories/search?token=' + TOKEN,
            method: 'POST',
            json: true,
            body: { archived: false, project_ids: [projectID] }
        }, callback);
    },

    checkForToken: function() {
        if (!TOKEN) {
            return displayNoTokenMessage();
        }
    }
};

function displayNoTokenMessage() {
  console.log('Missing CLUBHOUSE_API_TOKEN environment variable.');
  console.log('If you don\'t already have one, go to Clubhouse > Settings > Your Account > API Tokens to create one.');
  console.log('Then run this command:');
  console.log('CLUBHOUSE_API_TOKEN="MYTOKEN"');
}

