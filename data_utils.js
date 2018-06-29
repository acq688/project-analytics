var fs = require('fs');
var _ = require('lodash');
var moment = require('moment');

var DATE_FORMAT = 'YYYY-MM-DD';
var MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24;

var PROJECT_DIR = 'data';
var PROJECT_FILE = PROJECT_DIR + '/projects.js';

module.exports = {

    sortStories: function(stories) {
        result = {'open': [],
                  'completed': []};
        _.each(stories, function (story) {
            if (story.completed) {
                result.completed.push(story);
            } else {
                result.open.push(story);
            }
        });
        return result;
    },

    compileCompletedChartData: function(stories, project) {
        console.log('Compiling completed story data...');
        stories = _.sortBy(stories, function (story) {
            return new Date(story.completed_at).getTime();
        });

        var dateRange = calculateDateRangeForStories(stories);

        var data = 'var Data = {}; Data.ProjectName = "' + project.name + '"; Data.LastFetched="' + moment().format('MMMM D, YYYY') + '"; ';
        data += calculateStoryTypeData(stories, dateRange);
        data += calculateStoryRatioData(stories, dateRange);
        data += calculateMonthlyVelocityChartData(stories, dateRange);
        data += calculateMonthlyVelocityChartDataPoints(stories, dateRange);
        data += calculateCycleTimeChartData(stories, dateRange);
        data += calculateEstimateChartData(stories);

        return data;
    },

    compileOpenChartData: function(stories, project) {
        console.log('Compiling open story data...');
        var data = '';
        data += calculateEstimateChartData(stories, true);

        return data;
    },

    compileAllChartData: function(stories, project) {
        var data = '';
        if (stories.completed.length === 0 || stories.open.length === 0) {
            return data;
        }
        var dateRange = calculateDateRangeForStories(stories.completed);
        data += calculateBurndown(stories, dateRange);

        return data;
    },

    saveProjectsToFile: function(projects) {
        var data = 'var ClubhouseProjects = [];';
        _.each(_.filter(projects, { archived: false }), function (project) {
            data += 'ClubhouseProjects.push({ id: ' + project.id + ', name: "' + project.name + '" });';
        });
        _.each(_.filter(projects, { archived: true }), function (project) {
            data += 'ClubhouseProjects.push({ id: ' + project.id + ', name: "' + project.name + ' (archived)" });';
        });
        // data += 'ClubhouseProjects.push({ id: ' + 'all' + ', name: "' + 'all' + '" });';
        fs.writeFileSync(PROJECT_FILE, data);
    },

    writeDataToFile: function(project, data) {
        fs.writeFileSync(PROJECT_DIR + '/project-' + project.id + '.js', data);
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

function calculateMonthlyVelocityChartData(stories, dateRange) {
    var data = 'Data.MonthlyVelocityChart = [\n';
    var velocity = 0;

    _.each(dateRange, function (day) {
        _.each(stories, function (story) {
        if (story.completed_at.split('T')[0] === day) {
            // Measure by story count:
            velocity += 1;
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

function calculateMonthlyVelocityChartDataPoints(stories, dateRange) {
    var data = 'Data.MonthlyVelocityChartPoints = [\n';

    velocity_data = returnVelocityOverDateRange(stories, dateRange);
    _.each(velocity_data, function(vd) {
        data += '  [new Date("' + vd[0] + '"), ' + vd[1] + '],\n';
    });

    data += '];\n';

    return data;
}

function returnVelocityOverDateRange(stories, dateRange) {
    // This is a helper function for Monthly Velocity Chart
    // and for the burndown
    stories = _.sortBy(stories, function (story) {
        return new Date(story.completed_at).getTime();
    });

    var data = [];
    var velocity = 0;

    _.each(dateRange, function (day) {
        _.each(stories, function (story) {
        if (story.completed_at.split('T')[0] === day) {
            // Measure by points:
            if (story.estimate) {
              velocity += story.estimate;
            }
        }
        });

        if (day.split('-')[2] === '01') {
            data.push([day, velocity]);
            velocity = 0;
        }
    });

    return data;
}

function calculateBurndown(stories, dateRange) {
    var data = 'Data.Burndown = [\n';

    velocity_data = returnVelocityOverDateRange(stories.completed, dateRange);

    var sum = 0;
    for (var i=0; i < velocity_data.length; i++) {
        sum += velocity_data[i][1];
    }
    average = (sum/velocity_data.length);

    var open_stories = 0;
    _.each(stories.open, function(story) {
        open_stories += story.estimate;
    });

    var last_month = _.last(velocity_data)[0];
    var this_month = moment(last_month).add(1, 'months');

    while (open_stories > 0) {
        data += '  [new Date("' + this_month.format(DATE_FORMAT) + '"), ' + open_stories + '],\n';

        this_month = this_month.add(1, 'months');
        open_stories -= average;
    }
    data += '  [new Date("' + this_month.format(DATE_FORMAT) + '"), 0],\n';

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

function calculateEstimateChartData(stories, openStories) {
    var estimates = { None: 0 };

    _.each(stories, function (story) {
        var estimate = _.isNumber(story.estimate) ? story.estimate : 'None';

        if (estimates[estimate]) {
        estimates[estimate]++;
        } else {
        estimates[estimate] = 1;
        }
    });

    if (openStories) {
        return 'Data.OpenEstimateChart = ' + JSON.stringify(estimates) + ';\n';
    } else {
        return 'Data.EstimateChart = ' + JSON.stringify(estimates) + ';\n';
    }
}
