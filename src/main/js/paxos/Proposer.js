import {Accept, Prepare, ProposalId} from "./Messages.js";

class Proposer {
	// _isLeader; //this represents the node belief. Might be inaccurate
	// _cluster;
	// _nodeId;
	// _currentProposal;
	// _acceptSent;
	// _paxosInstanceNumber;
	// _messageHandler;

	constructor(messageHandler, paxosInstanceNumber, cluster, nodeId) {
		this.messageHandler = messageHandler;
		this._paxosInstanceNumber = paxosInstanceNumber;
		this._nodeId = nodeId;
		this._cluster = cluster;
		this._currentProposal = undefined;
		this._acceptSent = false;
	}

	prepareValue(value) {
		const proposal = new Proposal(this.messageHandler, this._paxosInstanceNumber, this._nodeId, this._cluster, value);
		this._currentProposal = proposal;
		proposal.broadcastPrepare();
	}

	handlePromise(promise) {
		if (promise.proposalId !== this._currentProposal.proposalId) {
			console.log(`Ignoring received promise ${promise.proposalId} as it does not match the current proposal ${this._currentProposal}`);
			return
		}

		this._currentProposal.registerPromise(promise);
		if (this._currentProposal.isPrepared() && !this._acceptSent) {
			this._acceptSent = true;
			this._currentProposal.broadcastAccept();
		}
	}
}

class Proposal {
	// _nodeId;
	// _proposalId;
	// _participantAcceptors;
	// _promisesMap;
	// _quorum;
	// _proposedValue;
	// _paxosInstanceNumber;
	// _messageHandler;

	constructor(messageHandler, paxosInstanceNumber, nodeId, cluster, value) {
		this.messageHandler = messageHandler;
		this._paxosInstanceNumber = paxosInstanceNumber;
		this._nodeId = nodeId;
		this._proposalId = new ProposalId(nodeId);
		this._participantAcceptors = cluster.acceptors;
		this._promisesMap = new Map();
		this._quorum = cluster.quorum;
		this._proposedValue = value;
	}

	registerPromise(promise) {
		const sourceNodeId = promise.sourceNodeId;
		if (!this._isSourceNodePartOfTheProposal(sourceNodeId)) {
			console.log(`Source node ${sourceNodeId} is not part of the proposal`);
			return
		}

		this._promisesMap.set(sourceNodeId, promise)
	}

	isPrepared() {
		return this._promises().length >= this._quorum;
	}

	broadcastPrepare() {
		this._participantAcceptors.forEach(acceptor => {
			const prepare = new Prepare(this._paxosInstanceNumber, this._nodeId, acceptor.id, this._proposalId);
			this.messageHandler.send(prepare);
		})
	}

	broadcastAccept() {
		this._participantAcceptors.forEach(acceptor => {
			const prepare = new Accept(this._paxosInstanceNumber, this._nodeId, acceptor.id, this.proposalId, this._calculateProposalValue());
			this.messageHandler.send(prepare);
		})
	}

	_isSourceNodePartOfTheProposal(sourceNodeId) {
		if (!this._participantAcceptors.some((acceptor) => acceptor.id === sourceNodeId)) {
			console.log(`Node ${sourceNodeId} is not part of this proposal`);
			return false
		}

		return true
	}

	_promises() {
		return Array.from(this._promisesMap.values())
	}

	_calculateProposalValue() {
		if (!this.isPrepared) {
			console.log(`Proposal is not prepared yet. You shouldn't care about the value.`);
			return
		}

		const everyoneRepliedNull = this._promises()
			.every(promise => promise.lastAcceptedValue === undefined);
		if (everyoneRepliedNull) {
			return this._proposedValue;
		} else {
			// use the one from the highest proposalId number seen
			const highestPromiseSeen = this._promises()
				.sort((a, b) => ProposalId.compare(a.lastAcceptedProposalId, b.lastAcceptedProposalId))
				.reverse()
				[0];

			return highestPromiseSeen.lastAcceptedValue;
		}
	}

	get proposalId() {
		return this._proposalId;
	}
}

export default Proposer;