require('dotenv').config()
var fs = require('fs');

var _ = require('lodash');
var calls = require('./calls');
var data_utils = require('./data_utils');

var PROJECT_DIR = 'data';
var PROJECT_FILE = PROJECT_DIR + '/projects.js';


function fetchAndCompileChartForProject(project, callback) {
    callback = _.isFunction(callback) ? callback : _.noop;
    console.log("Fetching data for: " + project.name);

    calls.fetchStories(project.id, function (err, res, allStories) {
        var data = '';

        stories = data_utils.sortStories(allStories);

        data += data_utils.compileCompletedChartData(stories.completed, project);
        data += data_utils.compileOpenChartData(stories.open, project);
        data += data_utils.compileAllChartData(stories, project);
        data_utils.writeDataToFile(project, data);
        callback();
    });
}

function fetchAndCompileChartsForAllProjects(projects) {
    // This pops the first thing off of the array
    var project = projects.shift();


    // I think this is recursive
    if (project) {
        fetchAndCompileChartForProject(project, function () {
        fetchAndCompileChartsForAllProjects(projects);
        });
    }
}

function findMatchingProjects(projects, query) {
  if (query === 'all') {
    return _.filter(projects, { archived: false });
  }

  if (!query) {
    return [];
  }

  return _.filter(projects, function (project) {
    return parseInt(query, 10) === project.id || project.name.toLowerCase().indexOf(query.toLowerCase()) === 0;
  });
}

function compileProjectData() {
  var query = process.argv[2];
  console.log('Fetching projects...');

  calls.fetchProjects(function (err, res, projects) {
    if (err || !projects || projects.length === 0) {
      console.log('No projects found!');
      return false;
    }

    projects = _.sortBy(projects, 'name');
    data_utils.saveProjectsToFile(projects);

    var foundProjects = findMatchingProjects(projects, query);
    if (foundProjects.length === 0) {
      if (query && foundProjects.length === 0) {
        console.log('Matching project not found!');
      }
      console.log('You have access to the following projects:\n');

      projects.forEach(function (project) {
        console.log('  - ' + project.name);
      });

      return false;
    }

    fetchAndCompileChartsForAllProjects(foundProjects);
  });
}


function init() {
  calls.checkForToken();

  if (!fs.existsSync('./' + PROJECT_DIR)) {
    fs.mkdirSync('./' + PROJECT_DIR);
  }

  compileProjectData();
}
/* MAIN FUNCTIONS */

init();
