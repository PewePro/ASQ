/**
 @fileoverview Socket code for the admin client.
 @author Jacques Dafflon jacques.dafflon@gmail.com
 */

/** Connect back to the server with a websocket */
var connect = function(host, port, session, mode) {
	var started = false;
	var socket = io.connect('http://' + host + ':' + port + '/ctrl');

	var updateViewersCount = function(event) {
		if (!event.users)
			return;
		var connectedViewers = event.users;
		// Draw icons for the first 50 viewers
		var lim = connectedViewers < 50 ? connectedViewers : 50;
		$('.connected-viewers-icons').empty();
		for (var i = 0; i < lim; i++) {
			if (i % 10 == 0) {
				$('.connected-viewers-icons').append('<br />');
			} else if (i % 5 == 0) {
				$('.connected-viewers-icons').append('<span>&nbsp;&nbsp;</span>');
			}
			$('.connected-viewers-icons').append('<i class="icon-user"> </i> ');
		}

		//update viewers count
		$(".connected-viewers-number").text(connectedViewers + " viewers");
		//$('#numConnectedViewers').text(connectedViewers + '');
		console.log('New viewer connected');
	}
	socket.on('connect', function(event) {
		socket.emit('asq:admin', {
			session : session
		});

		$('.connected-viewers-number').text("0 viewers connected")

		/**
		 Handle socket event 'new'
		 Notifies the admin of a new connection to the presentation.
		 */
		socket.on('asq:submit', function(event) {
			console.log("You've got an answer!");
			console.log(event);
			updateParticipation(event.submitted, event.users, event.questionId);
			updateStats(event.questionId);
		});

		/**
		 * Update the viewers count when users connect or disconnect.
		 */
		socket.on('asq:viewers-update', updateViewersCount);

		socket.on('asq:start', function(event) {
			if (!started) {
				impress().start();
				$('#welcomeScreen').modal('hide');
				$('#waitingScreen').hide();
				$('#slidesControll').show();

				started = true;
			}
		});

		socket.on('asq:goto', function(event) {
			if (mode == 'control') {
				$('.controlThumbs .thumbsWrapper .active').removeClass('active');
				$('.controlThumbs').scrollTo('.' + event.slide, 500, {
					offset : -150
				});
				$('.controlThumbs .thumbsWrapper .' + event.slide).addClass("active");

				var next = $('#' + event.slide).next().attr('id');
				$('#nextSlideFrame').attr('src', '/slidesRender/' + slidesId + '/#/' + next);
			}
			impress().goto(event.slide);
		});

		socket.on('asq:gotosub', function(event) {
			impress().gotoSub(event.substepIndex);
		});

		socket.on('asq:question', function(event) {
			window.alert("Question");
			showQuestion(event.question);
		});

		socket.on('asq:answer', function(event) {
			showAnswer(event.question, event.stats);
			//Question contains the answer.
		});

		socket.on('asq:hide-answer', function(event) {
			$('#answer').modal('hide');
		});

	});

	/**
	 Handle impress:stepgoto event
	 sSend a socket event to notify which slide to go to.
	 */
	document.addEventListener("impress:stepgoto", function(event) {
		socket.emit('asq:goto', {
			slide : event.target.id,
			session : session
		});
	});

	/**
	 Handle impress:stepgotosub event
	 sSend a socket event to notify which slide subtest to go to.
	 */
	document.addEventListener("impress:stepgotosub", function(event) {
		socket.emit('asq:gotosub', {
			substepIndex : event.detail.index,
			session : session
		});
	});

	/**
	 Handle impress:stepgoto event
	 sSend a socket event to notify which slide to go to.
	 */
	document.addEventListener("impress:start", function(event) {
		socket.emit('asq:start', {
			session : session,
			slide : $('#impress .active').attr('id')
		});
	});

	document.addEventListener('asq:close', function(event) {
		socket.emit('asq:goto', {
			session : session
		});
	});

	//Shows stasts/answers
	document.addEventListener('local:show-stats', function(event) {
		socket.emit('asq:show-stats', {});
	});
}
function updateParticipation(submitted, users, questionId) {
	var maxUsers = -1;
	if (maxUsers < users) {
		maxUsers = users;
	}
	if (maxUsers == submitted) {
		$('[data-question-id="' + questionId + '"] .progressNum').text('All answers received (' + submitted + '/' + maxUsers + '). ');
		$('[data-question-id="' + questionId + '"] .show-stats').attr("class", "btn btn-success");
	} else {
		$('[data-question-id="' + questionId + '"] .progressNum').text(submitted + '/' + maxUsers + ' answers received.');
	}
	var width = (submitted / maxUsers) * 100;
	$('[data-question-id="' + questionId + '"] .progress .bar').css('width', width + "%");
}

var showStats = function() {
	var myEvent = new CustomEvent('local:show-stats', {});
	document.dispatchEvent(myEvent);
}
var showQuestion = function(question) {
	$('.progessbar').css('width', "0%");
	$('#progressNum').text('Waiting for answers!');
	$('#question').modal('show');
	$('#questionText').html('<h3>' + question.questionText + '</h3>');
	var optionsstring = '';
	if (question.questionType == "Multiple choice") {
		optionsstring = '<span class="help-block">Please select all correct answers.</span>';
		for (var i = 0; i < question.answeroptions.length; i++) {
			optionsstring += '<label class="checkbox"><input type="checkbox">' + question.answeroptions[i].optionText + '</label>';
		}

	} else {
		optionsstring = '<span class="help-block">Please enter your solution. Capitalisation will be ignored.</span>';
		optionsstring += '<input type="text" placeholder="Your solution...">';
	}

	$('#answeroptions').html(optionsstring);

}
var showAnswer = function(question, stats) {
	console.log(stats.correct + "STATS!");
	var correct = stats.correct || null;
	var countedMcOptions = stats.countedMcOptions || null;
	var equalAnswers = stats.equalAnswers || null;
	google.load("visualization", "1", {
		packages : ["corechart"],
		callback : drawChart
	});

	//Google chart drawing for stats
	function drawChart() {
		console.log('GOOGLE CHART');
		if (question.questionType === "Multiple choice") {
			var mscstatData = google.visualization.arrayToDataTable(countedMcOptions);
		}
		var rvswData = google.visualization.arrayToDataTable(correct);
		var diffAnsData = google.visualization.arrayToDataTable(equalAnswers);

		var rvswOpt = {
			title : 'Correct vs. Wrong',
			'width' : 760,
			'height' : 400,
			chartArea : {
				left : 0,
				top : 0,
				width : "600px",
				height : "350px"
			}
		};

		var mscstatOpt = {
			animation : {
				duration : 1000
			},
			hAxis : {
				allowContainerBoundaryTextCufoff : true,
				slantedTextAngle : 50
			},
			'width' : 760,

			'legend' : {
				position : 'top',
				textStyle : {
					fontSize : 16
				}
			}
		};

		var chart3 = new google.visualization.PieChart(document.getElementById('rvswChart'));
		chart3.draw(rvswData, rvswOpt);

		if (question.questionType === "Multiple choice") {
			var chart = new google.visualization.ColumnChart(document.getElementById('mscstatChart'));
			chart.draw(mscstatData, mscstatOpt);
		} else {
			$('#mscstats').css("display", 'none');
			$('#mscstats').removeAttr('style');
			$('#mscstatsBtn').remove();
		}

		var chart = new google.visualization.ColumnChart(document.getElementById('diffAnsChart'));
		chart.draw(diffAnsData, mscstatOpt);
	}


	$('#answerText').html('<h3>Statistics for "' + question.questionText + '"</h3>');
	var optionsstring = '<h5>Correct answer:</h5>';
	if (question.questionType == "Multiple choice") {
		for (var i = 0; i < question.answeroptions.length; i++) {
			optionsstring += '<label class="checkbox" >';
			if (question.answeroptions[i].correct == true) {
				optionsstring += '<i class="icon-ok"> </i> ';
			} else {
				optionsstring += '<i class="icon-remove"> </i> ';
			}
			optionsstring += question.answeroptions[i].optionText + '</label>';
		}
	} else {
		optionsstring = '<span class="help-block">Correct answer.</span>';
		optionsstring += '<p>' + +'</p>';
		optionsstring += '<span class="help-block">Your answer.</span>';
		optionsstring += '<input type="text" value="Norway" readonly>';
	}
	//google.setOnLoadCallback(drawChart);
	//drawChart();
	//update modal content
	$('#answersolutions').html(optionsstring);
	$('#question').modal('hide');
	$('#answer').modal('show');
};

google.load("visualization", "1", {
	packages : ["corechart"]
});

google.setOnLoadCallback(drawChart);

var rightVsWrongOptions ={
	width : 800,
};

distinctAnswersOptions = {
	title : 'How often was a group of options selected',
	width : 800,
	isStacked : true,
	legend : {
		position : 'top',
		alignment : 'center'
	}
};

distinctOptionsOptions = {
	title : 'How often was an option selected',
	isStacked : true,
	width : 800,
	legend : {
		position : 'top',
		alignment : 'center'
	}
};

var rightVsWrongData = new Array();
var rightVsWrongChart = new Array();

var participationData = new Array();
var participationChart= new Array();

var distinctOptionsData = new Array();
var distinctOptionsChart = new Array();

var distinctAnswersData = new Array();
var distinctAnswersChart = new Array();

function drawChart() {
	$('.stats').each(function(el) {
		var questionId = $(this).data('target-assessment-id');
		//var sampler = google.visualization.arrayToDataTable([['Correctness', 'Number of submissions'], ['Correct answers', 19], ['Wrong answers', 4]]);
		//var sampleo = google.visualization.arrayToDataTable([['Option', 'Correct answers', 'Wrong answers'], ['Switzerland', 19, 0], ['Italy', 0, 3], ['France', 0, 1], ['Europe', 23, 0]]);
		//var samplea = google.visualization.arrayToDataTable([['Submission', 'Correct answers', 'Wrong answers'], ['Europe & Switzerland', 19, 0], ['Europe & Italy', 0, 3], ['Europe & France', 0, 1]]);
		//RightVsWrongData[questionId] = sampler;
		//distinctOptionsData[questionId] = sampleo;
		//distinctAnswersData[questionId] = samplea;
		rightVsWrongChart[questionId] = new google.visualization.PieChart($(this).find(".rvswChart")[0]);
		distinctOptionsChart[questionId] = new google.visualization.ColumnChart($(this).find(".distinctOptions")[0]);
		distinctAnswersChart[questionId] = new google.visualization.ColumnChart($(this).find(".distinctAnswers")[0]);
	})
}


$('a[data-toggle="tab"]').on('shown', function(e) {
	var questionId = $(this).parent().parent().parent().data('target-assessment-id');
	//console.log(questionId);
	$.getJSON('/stats/getStats?question=' + questionId + '&metric=rightVsWrong', function(data) {
		rightVsWrongData[questionId] = google.visualization.arrayToDataTable(data);
		rightVsWrongChart[questionId].draw(rightVsWrongData[questionId], rightVsWrongOptions);
	});
	$.getJSON('/stats/getStats?question=' + questionId + '&metric=distinctOptions', function(data) {
		distinctOptionsData[questionId] = google.visualization.arrayToDataTable(data);
		distinctOptionsChart[questionId].draw(distinctOptionsData[questionId], distinctOptionsOptions);
	});
	$.getJSON('/stats/getStats?question=' + questionId + '&metric=distinctAnswers', function(data) {
		distinctAnswersData[questionId] = google.visualization.arrayToDataTable(data);
		distinctAnswersChart[questionId].draw(distinctAnswersData[questionId], distinctAnswersOptions);
	});

});


function updateStats(questionId){
	$.getJSON('/stats/getStats?question=' + questionId + '&metric=rightVsWrong', function(data) {
		rightVsWrongData[questionId] = google.visualization.arrayToDataTable(data);
		rightVsWrongChart[questionId].draw(rightVsWrongData[questionId], rightVsWrongOptions);
	});
	$.getJSON('/stats/getStats?question=' + questionId + '&metric=distinctOptions', function(data) {
		distinctOptionsData[questionId] = google.visualization.arrayToDataTable(data);
		distinctOptionsChart[questionId].draw(distinctOptionsData[questionId], distinctOptionsOptions);
	});
	$.getJSON('/stats/getStats?question=' + questionId + '&metric=distinctAnswers', function(data) {
		distinctAnswersData[questionId] = google.visualization.arrayToDataTable(data);
		distinctAnswersChart[questionId].draw(distinctAnswersData[questionId], distinctAnswersOptions);
	});
}
