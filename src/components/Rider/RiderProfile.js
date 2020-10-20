import React from 'react';


import Page from '../partials/Page';
import { connect } from 'react-redux';

import { getRider } from '../../actions';
import { ProgressSpinner } from 'primereact/progressspinner';
import { withRouter } from 'react-router-dom';
import RiderResults from './RiderResults';


class RiderProfile extends React.Component {
    
    componentDidMount() {
        this.props.getRider(this.props.match.params.id);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.match.params.id !== this.props.match.params.id) {
            this.props.getRider(this.props.match.params.id);
        }
    }

    getMenuItems() {
        const tests = this.props.rider ? this.props.rider.testlist.map( testcode => {
            return {
                label: testcode,
                className: this.props.match.params.testcode === testcode ? 'active' : null,
                command: () => this.props.history.push(`/rider/${this.props.rider.id}/results/${testcode}`)
            };
        }) : [];

        return [
            {
                label: "Overview",
                className: !this.props.match.params.testcode ? "active" : null,
                command: () => this.props.history.push(`/rider/${this.props.rider.id}`)
            },
            {
                label: "Results",
                items: tests
            }
        ];
    }
    

    getFullName() {
        return this.props.rider ? `${this.props.rider.firstname} ${this.props.rider.lastname}` : null;
    }

    getTitle() {
        switch(this.props.match.params.page) {
            case "results":
                return `${this.props.match.params.testcode} results`;
            default:
                return "Overview";
        }
    }

    getContent() {
        if (this.props.rider) {
            switch(this.props.match.params.page) {
                case 'results':
                    return <RiderResults testcode={this.props.match.params.testcode} riderId={this.props.match.params.id} />;
                default:
                    return <p>Overview</p>
            }
        }
    }

    render() {
        return (
            <Page title={this.getFullName()} icon="user" menuItems={this.getMenuItems()}>
                <div className="row">
                    <div className="col">
                        <h2 className="subtitle">{this.getTitle()}</h2>
                        {this.getContent()}
                    </div>
                </div>
           </Page>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    return {
        rider: state.riders[ownProps.match.params.id]
    }
}

export default withRouter(connect(mapStateToProps, { getRider })(RiderProfile));