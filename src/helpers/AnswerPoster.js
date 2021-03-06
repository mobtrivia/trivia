export function submitAnswer(answers, name, round, roundRef, teamName) {
    console.log(answers);
    const { questions } = round;
    questions.forEach((question, i) => {
        if (answers[i]) {
            console.log(answers[i]);
            const questionRef = roundRef.child('questions').child(i);
            const points = gradeQuestion(question, answers[i].answer, questionRef, teamName);
            if (question.userAnswer === undefined) {
                question.userAnswer = {};
            }
            question.userAnswer[teamName] = answers[i].answer;
            if (question.questionType !== 'closest') {
                addScoreToDatabase(question, questionRef, points, teamName);
            }
            console.log("Question " + (i+1) + ": " + points + " points");
        }
    });
}

function addScoreToDatabase(question, questionRef, points, teamName) {
    let { scores } = question;
    if (scores === undefined) {
        scores = {};
    }
    scores[teamName] = points;
    question.scores = scores;
    questionRef.set(question);
}

function gradeQuestion(question, answer, questionRef, teamName) {
    if (answer === '' || answer === undefined || answer === null) {
        return 0;
    } else {
        answer = answer.toLowerCase();
        const { questionType } = question;
        if (questionType === 'text') {
            return gradeTextQuestion(question, answer) ? parseFloat(question.score) : 0;
        }
        if (questionType === 'number') {
            return gradeNumberQuestion(question, answer) ? parseFloat(question.score) : 0;
        }
        if (questionType === 'closest') {
            return gradeClosestQuestion(question, answer, questionRef, teamName);
        }
        if (questionType === 'multiple_choice') {
            return gradeMultipleChoiceQuestion(question, answer) ? parseFloat(question.score) : 0;
        }
        if (questionType === 'multiple_answers') {
            let numCorrect = 0;
            question.multipleAnswers.forEach((q,i) => {
                numCorrect += gradeTextQuestion(q, answer[i]) ? 1 : 0
            });
            if (numCorrect > 0) {
                return question.multipleScores[numCorrect-1];
            }
            return 0;
        }
        if (questionType === 'speed') {
            return gradeSpeedQuestion(question, answer, questionRef, teamName);
        }
        // console.log(question.questionType);

    }
}

function gradeTextQuestion(question, answer) {
    const { answerType, possibleAnswers } = question;
    for (let i = 0; i < possibleAnswers.length; i++) {
        const possibleAnswer = possibleAnswers[i].toLowerCase();
        if (answerType === 'exactly' && possibleAnswer === answer) {
            return true;
        }
        if (answerType === 'contains' && answer.includes(possibleAnswer)) {
            return true;
        }
    }
    return false;
}

function gradeNumberQuestion(question, answer) {
    let margin;
    try {
        margin = parseFloat(question.margin);
    } catch(err) {
        margin = 0;
    }
    const correctAnswer = parseFloat(question.numberAnswer);
    return (parseFloat(answer) >= (correctAnswer - margin) && parseFloat(answer) <= (correctAnswer + margin));
}

function gradeMultipleChoiceQuestion(question, answer) {
    return question.correctChoice === answer;
}

function gradeClosestQuestion(question, answer, questionRef, teamName) {
    let { guesses, numberAnswer, positionScoring } = question;
    if (guesses === undefined) {
        guesses = [];
    }
    // Removing duplicate guesses by same team
    let teamGuessIndex = -1;
    guesses.forEach((guess, i) => {
        if (guess.teamName === teamName) {
            teamGuessIndex = i
        }
    });
    if (teamGuessIndex >= 0) {
        guesses.splice(teamGuessIndex, 1);
    }
    guesses.push({num: parseFloat(answer), teamName: teamName});
    guesses.sort((a, b) => sortByGuessDistance(a.num, b.num, numberAnswer));
    question.guesses = guesses;
    question.scores = updateScoring(guesses, positionScoring);
    questionRef.set(question);
    return question.scores[teamName];
}

function gradeSpeedQuestion(question, answer, questionRef, teamName) {
    let { guesses, scoreType, clues, positionScoring } = question;
    if (guesses === undefined) {
        guesses = [];
    }
    let cluesRevealed = 0;
    clues.forEach(clue => {
        if (clue.show) {
            cluesRevealed++;
        }
    });
    const correct = gradeTextQuestion(question, answer);
    guesses.push({guess: answer, teamName: teamName, cluesRevealed: cluesRevealed, correct: correct});
    question.guesses = guesses;
    questionRef.set(question);
    if (!correct) {
        // Incorrect answer
        return 0;
    }
    if (scoreType === 'clues_revealed') {
        if (cluesRevealed === 0) {
            // Guess before any clues are revealed?
            return positionScoring[0];
        } else {
            return positionScoring[cluesRevealed-1];
        }
    }
    if (scoreType === 'position') {
        const correctAnswers = guesses.filter(guess => gradeTextQuestion(question, guess.guess));
        if (correctAnswers.length > positionScoring.length) {
            return 0;
        } else {
            return positionScoring[correctAnswers.length-1];
        }
    }
}

function updateScoring(guesses, positionScoring) {
    const scoring = {};
    guesses.forEach((guess, i) => {
        const { num, teamName } = guess;
        if (i > 0 && parseFloat(guesses[i-1].num) === parseFloat(num)) {
            // 2 people have the same guess
            scoring[teamName] = scoring[guesses[i-1].teamName];
        }
        else if (Object.keys(scoring).indexOf(teamName) === -1) {
            if (i < positionScoring.length) {
                scoring[teamName] = parseFloat(positionScoring[i])
            } else {
                scoring[teamName] = 0;
            }
        }
    });
    return scoring;
}

function sortByGuessDistance(a,b,numberAnswer) {
    return Math.abs(parseFloat(a) - parseFloat(numberAnswer)) - Math.abs(parseFloat(b) - parseFloat(numberAnswer))
}