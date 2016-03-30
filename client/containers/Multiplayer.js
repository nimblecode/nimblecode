import React, { PropTypes, Component } from 'react';
import CodeEditorMulti from './CodeEditorMulti';
import CodePromptMulti from '../components/CodePromptMulti';
import TimerMulti from './TimerMulti';
import MultiplayerInfo from '../components/MultiplayerInfo';
import levenshtein from './../lib/levenshtein';
import ProgressBarMulti from './ProgressBarMulti';
import { connect } from 'react-redux';
import { startGame, endGame, stopTimer, storeGameId, syncMultiplayerStatuses, startCountdown, getUsername, leavePage } from '../actions/index';
import { bindActionCreators } from 'redux';
import underscore from 'underscore';

class Multiplayer extends Component {
  
  static contextTypes = {
    router: PropTypes.object
  }

  constructor() {
    super();

    this.state = {
      currentPuzzle: 'N/A',
      minifiedPuzzle: 'N/A'
    };

  };

  componentWillMount() {
    this.username = this.props.getUsername().payload;
  };

  componentDidMount() {
    this.socket = io();

    if(this.props.params.gameId){
      this.props.storeGameId(this.props.params.gameId);

      this.socket.emit('create new game', {roomcode:this.props.params.gameId, username: this.username});
    }

    // listen
    this.socket.on('player joined', function(players) {
      this.props.syncMultiplayerStatuses(players);
    }.bind(this));

    // listen
    this.socket.on('here is your prompt', function(prompt) {
      var minifiedPuzzle = prompt.replace(/\s/g,'');

      this.setState({
        currentPuzzle: prompt,
        minifiedPuzzle: minifiedPuzzle
      });

    }.bind(this));

    // listening for a 'all players progress' socket event and
    // collects all players' code from socket
    this.socket.on('all players progress', function(players) {
      underscore.map(players, function(obj, key){
        var playerPercent = this.calculatePercent(players[key][2]);
        players[key][1] = playerPercent;
      }.bind(this));
      this.props.syncMultiplayerStatuses(players);

    }.bind(this));

    // listening for a 'game over' socket event to capture and stop time
    this.socket.on('game over', function(value) {
      var time = this.props.gameTime;
      underscore.once(this.saveTimeElapsed(time.hundredthSeconds, time.tenthSeconds, time.seconds, time.minutes, value.username));

      this.props.stopTimer();
    }.bind(this));
  };

  componentWillUnmount() {
    this.socket.emit('disconnected',{roomcode:this.props.params.gameId, username: this.username})
    this.socket.disconnect();
    this.props.leavePage();
  };

  componentDidUpdate() {
    // if player finishes the puzzle, ENDED_GAME action is sent, and 'game won' socket emitted
    if (this.props.multiGameState === 'ENDED_GAME') {
      var socketInfo = {
        gameId: this.props.params.gameId,
        username: this.username,
        id: this.socket.id,
        hasWon: true
      };
      underscore.once(this.socket.emit('game won', socketInfo));
    }
  };

  sendToMultiplayerLandingPage() {
    this.context.router.push('multiplayer');
  };

  saveTimeElapsed(hundredthSeconds, tenthSeconds, seconds, minutes, winner) {
    let yourTime = (minutes*60 + seconds + tenthSeconds/10 + hundredthSeconds/100).toFixed(2);
    if (winner === this.username) {
      // Sweet Alert with Info
      swal({
        title: 'Sweet!',
        text: 'You won with a time of ' + yourTime + ' seconds!',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Take me home',
        cancelButtonText: 'Create/Join a new game',
        confirmButtonClass: 'btn  btn-raised btn-success',
        cancelButtonClass: 'btn btn-raised btn-info',
        buttonsStyling: false,
        closeOnConfirm: true,
        closeOnCancel: true
      }, function(isConfirm) {
        if (isConfirm === true) {
          console.log('user has clicked take me home');
          this.context.router.push('/');
        } else if (isConfirm === false) {
          console.log('user wants to create/join new game');
          this.context.router.push('multiplayer');
        } else {
          console.log('user has clicked outside, should send multiplayer');
          // TODO: have some message that says, sending to multiplayer
          this.context.router.push('multiplayer');
        }
      }.bind(this));
    } else {
      // if current player is not the winner, display winner's ID
      swal({
        title: 'Sorry!',
        text: winner + ' won with a time of ' + yourTime + ' seconds!',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Take me home',
        cancelButtonText: 'Create/Join a new game',
        confirmButtonClass: 'btn  btn-raised btn-success',
        cancelButtonClass: 'btn btn-raised btn-info',
        buttonsStyling: false,
        closeOnConfirm: true,
        closeOnCancel: true
      }, function(isConfirm) {
        if (isConfirm === true) {
          console.log('user has clicked take me home');
          this.context.router.push('/');
        } else if (isConfirm === false) {
          console.log('user wants to create/join new game');
          this.context.router.push('multiplayer');
        } else {
          console.log('user has clicked outside, should send multiplayer');
          // TODO: have some message that says, sending to multiplayer
          this.context.router.push('multiplayer');
        }
      }.bind(this));
    }
  };

  calculatePercent(playerCode) {
    // typed code is passed in, and percent completed is calculated and returned
    var miniCode = playerCode.replace(/\s/g,'');
    var totalChars = this.state.minifiedPuzzle.length;
    var distance = levenshtein(this.state.minifiedPuzzle, miniCode);

    var percentCompleted = Math.floor(((totalChars - distance) / totalChars) * 100);
    return percentCompleted;
  };

  // sends current player's code to the socket to broadcast
  sendProgressToSockets(code, roomcode) {
    var data = {
      roomcode: roomcode,
      username: this.username,
      code: code
    }

    this.socket.emit('player progress', data);
  };

  render() {
    return (
      <div>
        <MultiplayerInfo gameId={this.props.params.gameId} />
        <TimerMulti
          saveTimeElapsed={this.saveTimeElapsed.bind(this)}
          socket={this.socket} />
        <div className="col-sm-10 col-sm-offset-1 no-padding">
          <div className="col-sm-6"><h5><b>Copy this code</b></h5></div>
          <div className="col-sm-6"><h5><b>Type it here</b></h5></div>
          <CodePromptMulti puzzle={this.state.currentPuzzle} />
          <CodeEditorMulti
            puzzle={this.state.currentPuzzle}
            minifiedPuzzle={this.state.minifiedPuzzle}
            sendProgressToSockets={this.sendProgressToSockets.bind(this)} />
        </div>
        
        <div className="col-sm-10 col-sm-offset-1 no-padding">        
          <ProgressBarMulti socket={this.socket} />
        </div>

      </div>
    )
  };
};

function mapStateToProps(state) {
  return {
    multiGameState: state.multiGameState,
    gameTime: state.gameTime,
    savedGame: state.savedGame,
    multiplayerStatuses: state.multiplayerStatuses,
    SavedUsername: state.SavedUsername
  }
};

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
    startGame: startGame,
    storeGameId: storeGameId,
    endGame: endGame,
    stopTimer: stopTimer,
    syncMultiplayerStatuses: syncMultiplayerStatuses,
    startCountdown: startCountdown,
    getUsername: getUsername,
    leavePage: leavePage
  }, dispatch);
};

export default connect(mapStateToProps, mapDispatchToProps)(Multiplayer);
