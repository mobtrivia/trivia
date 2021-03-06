import React from 'react';
import app from 'firebase/app';
import firebase from 'firebase';
import Questions from "../old_stuff/Questions";
import LevenshteinDistance from "../old_stuff/LevenshteinDistance";
import {Table, Modal, Switch} from "antd";
import { storage } from "firebase";
import QuestionCreator from "./QuestionCreator";
import {submitQuestion} from "../../helpers/QuestionPoster";

const ordinalSuffix = (i) => {
    var j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        return i + "st";
    }
    if (j == 2 && k != 12) {
        return i + "nd";
    }
    if (j == 3 && k != 13) {
        return i + "rd";
    }
    return i + "th";
};

const renderAnswers = (text, record) => {
    const { questionType } = record;
    if (questionType === 'text' || questionType === 'speed') {
        return <div>
            {record.answerType.toUpperCase()} [{record.possibleAnswers.join(', ')}]
        </div>
    }
    if (questionType === 'number' || questionType === 'closest') {
        return <div>
            {record.numberAnswer}
            {record.margin && (' +- ' + record.margin)}
        </div>
    }
    if (questionType === 'multiple_answers') {
        return <div>
            {record.multipleAnswers.map((answer, i) => {
                return <div>
                    {i+1}: {answer.answerType.toUpperCase()} [{answer.possibleAnswers.join(', ')}]
                </div>
            })}
        </div>
    }
    if (questionType === 'multiple_choice') {
        return <div>
            {record.correctChoice.toUpperCase()} from [{record.choices.join(', ')}]
        </div>
    }
    return text;
};

const renderScores = (text, record) => {
    const { questionType } = record;
    if (questionType === 'text' || questionType === 'number' || questionType === 'multiple_choice') {
        return <div>
            {record.score} point(s)
        </div>
    }
    if (questionType === 'closest') {
        return record.positionScoring.map((score, i) => <div>{ordinalSuffix(i+1)} closest: {score} point(s)</div>)
    }
    if (questionType === 'multiple_answers') {
        return record.multipleScores.map((score, i) => <div>{i+1} Correct: {score} point(s)</div>)
    }
    if (questionType === 'speed') {
        if (record.scoreType === 'clues_revealed') {
            return record.positionScoring.map((score, i) => <div>{i+1} clue(s) revealed: {score} point(s)</div>)
        }
        if (record.scoreType === 'position') {
            return record.positionScoring.map((score, i) => <div>{ordinalSuffix(i+1)}: {score} point(s)</div>)
        }
    }
    return text;
};

export default class RoundCreator extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            modalOpen: false,
        };
        this.questionCreatorRef = React.createRef();
        this.columns = [
            {
                title: 'Question',
                dataIndex: 'question',
                key: 'question',
                render: this.renderQuestions,
            },
            {
                title: 'Question Type',
                dataIndex: 'questionType',
                key: 'question_type',
            },
            {
                title: 'Clues/Options',
                dataIndex: 'clues',
                key: 'clues',
                render: this.renderClues,
            },
            {
                title: 'Answers',
                dataIndex: 'answers',
                key: 'answers',
                render: renderAnswers,
            },
            {
                title: 'Scoring',
                dataIndex: 'scoring',
                key: 'scoring',
                render: renderScores,
            },
        ];
    }

    beginSpeedRound = (record, i) => {
        const { roundRef } = this.props;
        const qRef = roundRef.child('questions').child(i);
        record.begin = true;
        qRef.set(record);
    };

    endSpeedRound = (record, i) => {
        const { roundRef } = this.props;
        const qRef = roundRef.child('questions').child(i);
        record.begin = false;
        record.clues.forEach(clue => clue.show = false);
        qRef.set(record);
    };

    showClue = (clue, i, clueIndex) => {
        const { roundRef } = this.props;
        const clueRef = roundRef.child('questions').child(i).child('clues').child(clueIndex);
        clue.show = true;
        clueRef.set(clue);
    };

    hideClue = (clue, i, clueIndex) => {
        const { roundRef } = this.props;
        const clueRef = roundRef.child('questions').child(i).child('clues').child(clueIndex);
        clue.show = false;
        clueRef.set(clue);
    };

    renderSpeedClues = (record, i) => {
        return record.clues.map((clue, clueIndex) => {
            let clueButton;
            if (clue.show) {
                clueButton = <button onClick={() => this.hideClue(clue, i, clueIndex)}>Hide</button>
            } else {
                clueButton = <button onClick={() => this.showClue(clue, i, clueIndex)}>Show</button>
            }
            return <div>
                Clue {clueIndex+1}: {clue.clue}
                {record.begin && clueButton}
            </div>
        })
    };

    renderClues = (text, record, i) => {
        const { questionType } = record;
        if (questionType === 'multiple_choice') {
            return record.choices.map(choice => <div>{choice}</div>);
        }
        if (questionType === 'speed') {
            return this.renderSpeedClues(record, i);
        }
        return text;
    };

    renderQuestions = (text, record, index) => {
        const { questionType } = record;
        if (questionType === 'speed') {
            return <div>
                {text}
                {record.begin ? <button
                    onClick={() => this.endSpeedRound(record, index)}>
                    End
                </button> : <button
                    onClick={() => this.beginSpeedRound(record, index)}>
                    Begin
                </button>
                }
            </div>
        }
        return text;
    };

    addQuestion = () => {
        this.setState({
            modalOpen: true,
        })
    };

    handleOk = (e) => {
        const { round } = this.props;
        const { roundRef } = this.props;
        try {
            const infoForPosting = this.questionCreatorRef.current.getInfoForPosting();
            submitQuestion(infoForPosting, round, roundRef);
            this.setState({
                modalOpen: false,
            })
        } catch(err) {
            console.log(err);
        }

    };

    handleCancel = () => {
        this.setState({
            modalOpen: false,
        })
    };

    toggleShowRound = (e, round) => {
        const { roundRef } = this.props;
        round.show = e;
        round.questions.forEach((question, i) => {
            if (question.questionType === 'speed') {
                question.begin = false;
                question.clues.forEach(clue => clue.show = false);
            }
        });
        roundRef.set(round);
    };

    render() {
        const { round } = this.props;
        const { modalOpen } = this.state;
        return (
            <div>
                <div>
                    <div>
                        Show round: <Switch checked={round.show} onChange={e => this.toggleShowRound(e,round)} />
                    </div>
                    {round.questions && <Table columns={this.columns} dataSource={round.questions} pagination={false} />}
                    <button onClick={this.addQuestion}>Add question</button>
                    <Modal
                        title="Create a question"
                        visible={modalOpen}
                        onOk={this.handleOk}
                        onCancel={this.handleCancel}
                    >
                        <QuestionCreator ref={this.questionCreatorRef}/>
                    </Modal>
                </div>
            </div>
        );
    }

}