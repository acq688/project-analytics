var fs = require('fs');
var _ = require('lodash');
var moment = require('moment');

var DATE_FORMAT = 'YYYY-MM-DD';
var MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24;

var PROJECT_DIR = 'data';
var PROJECT_FILE = PROJECT_DIR + '/projects.js';

module.exports = {

    compileChartData: function(stories, project) {
        console.log('Compiling story data...');
        stories = _.sortBy(stories, function (story) {
            return new Date(story.completed_at).getTime();
        });

        var dateRange = calculateDateRangeForStories(stories);

        var data = 'var Data = {}; Data.ProjectName = "' + project.name + '"; Data.LastFetched="' + moment().format('MMMM D, YYYY') + '"; ';
        data += calculateStoryTypeData(stories, dateRange);
        data += calculateStoryRatioData(stories, dateRange);
        data += calculateMonthlyVelocityChartData(stories, dateRange);
        data += calculateCycleTimeChartData(stories, dateRange);
        data += calculateEstimateChartData(stories);

        fs.writeFileSync(PROJECT_DIR + '/project-' + project.id + '.js', data);
    },

    saveProjectsToFile: function(projects) {
        var data = 'var ClubhouseProjects = [];';
        _.each(_.filter(projects, { archived: false }), function (project) {
            data += 'ClubhouseProjects.push({ id: ' + project.id + ', name: "' + project.name + '" });';
        });
        _.each(_.filter(projects, { archived: true }), function (project) {
            data += 'ClubhouseProjects.push({ id: ' + project.id + ', name: "' + project.name + ' (archived)" });';
        });
        fs.writeFileSync(PROJECT_FILE, data);
    }
};

function calculateStoryRatioData(stories, dateRange) {
    var data = 'Data.StoryTypeRatios = [\n';
    var totals = {
        feature: 0,
        bug: 0,
        chore: 0,
        total: 0
    };

    _.each(dateRange, function (day) {
        _.each(stories, function (story) {
        if (story.completed_at.split('T')[0] === day) {
            // Measure by story count:
            totals[story.story_type] += 1;
            totals.total += 1;

            // Measure by points:
            // if (story.estimate) {
            //   totals[story.story_type] += story.estimate;
            // }
        }
        });
        data += '  [new Date("' + day + '"), ' + (totals.feature / totals.total) + ', ' + (totals.bug / totals.total) + ', ' + (totals.chore / totals.total) + '],\n';
    });

    data += '];\n';

    return data;
}

function calculateStoryTypeData(stories, dateRange) {
    var data = 'Data.StoryTypeData = [\n';
    var totals = {
        feature: 0,
        bug: 0,
        chore: 0
    };

    _.each(dateRange, function (day) {
        _.each(stories, function (story) {
        if (story.completed_at.split('T')[0] === day) {
            // Measure by story count:
            totals[story.story_type] += 1;

            // Measure by points:
            // if (story.estimate) {
            //   totals[story.story_type] += story.estimate;
            // }
        }
        });
        data += '  [new Date("' + day + '"), ' + totals.feature + ', ' + totals.bug + ', ' + totals.chore + '],\n';
    });

    data += '];\n';

    return data;
}

function calculateCycleTimeChartData(stories, dateRange) {
    var data = 'Data.CycleTimeChart = [\n';
    var cycleTimes = [];

    _.each(dateRange, function (day) {
        _.each(stories, function (story) {
        if (story.completed_at.split('T')[0] === day) {
            var cycleTime = (new Date(story.completed_at).getTime() - new Date(story.started_at).getTime()) / MILLISECONDS_IN_A_DAY;

            cycleTimes.push(cycleTime);
        }
        });

        if (day.split('-')[2] === '01') {
        data += '  [new Date("' + day + '"), ' + _.max(cycleTimes) + ', ' + _.mean(cycleTimes) + ', ' + _.min(cycleTimes) + '],\n';
        cycleTimes = [];
        }
    });

    data += '];\n';

    return data;
}

function calculateEstimateChartData(stories) {
    var estimates = { None: 0 };

    _.each(stories, function (story) {
        var estimate = _.isNumber(story.estimate) ? story.estimate : 'None';

        if (estimates[estimate]) {
        estimates[estimate]++;
        } else {
        estimates[estimate] = 1;
        }
    });

    var data = 'Data.EstimateChart = ' + JSON.stringify(estimates) + ';\n';

    return data;
}

function calculateMonthlyVelocityChartData(stories, dateRange) {
    var data = 'Data.MonthlyVelocityChart = [\n';
    var velocity = 0;

    _.each(dateRange, function (day) {
        _.each(stories, function (story) {
        if (story.completed_at.split('T')[0] === day) {
            // Measure by story count:
            velocity += 1;

            // Measure by points:
            // if (story.estimate) {
            //   velocity += story.estimate;
            // }
        }
        });

        if (day.split('-')[2] === '01') {
        data += '  [new Date("' + day + '"), ' + velocity + '],\n';
        velocity = 0;
        }
    });

    data += '];\n';

    return data;
}

function calculateDateRangeForStories(stories) {
  var timestamps = storiesToCompletedTimestamps(stories);
  var fromDate = _.min(timestamps);
  var toDate = _.max(timestamps);

  return createDateRange(fromDate, toDate);
}

function createDateRange(fromDate, toDate) {
  var stack = [];
  var fromMoment = moment(fromDate);
  var toMoment = moment(toDate);

  while (fromMoment.isBefore(toMoment) || fromMoment.isSame(toMoment, 'days')) {
    stack.push(fromMoment.format(DATE_FORMAT));
    fromMoment = fromMoment.add(1, 'days');
  }

  return stack;
}

function storiesToCompletedTimestamps(stories) {
  return _.map(stories, function (story) {
    return new Date(story.completed_at).getTime();
  });
}