import React from 'react';
import firebase from 'firebase';
import { Collapse } from 'antd';
import {
    Link,
    useParams,
    withRouter,
} from "react-router-dom";

class QuizTaker extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            quiz: {},
        };
    }

    componentDidMount() {
        const { name } = this.props.match.params;
        const self = this;
        this.quizRef = firebase.database().ref('quizzes').child(name);
        this.quizRef.on('value', snapshot => {
            self.setState({
                quiz: snapshot.val(),
            });
        });
    }

    render() {
        const { quiz } = this.state;
        const rounds = quiz.rounds;
        return (
            <div>
                <h1>Quiz name here: {quiz && quiz.name}</h1>
                <Collapse defaultActiveKey={'0'}>
                    {rounds && Object.keys(rounds).map((roundName, i) => {
                        const round = rounds[roundName];
                        return <div style={{display: 'flex', flexDirection: 'row'}}>
                            <p>{roundName}</p>
                            {round.show && <Link to={'/participant/' + quiz.name + '/' + round.name}>View</Link>}
                        </div>
                    })}
                </Collapse>
            </div>
        );
    }
}

export default withRouter(QuizTaker)