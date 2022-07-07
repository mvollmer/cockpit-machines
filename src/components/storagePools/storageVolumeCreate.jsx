/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2019 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Button, Form, Modal, Tooltip } from '@patternfly/react-core';
import cockpit from 'cockpit';

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { DialogsContext } from 'dialogs.jsx';
import { units, getDefaultVolumeFormat, convertToUnit, isEmpty } from '../../helpers.js';
import { storageVolumeCreate } from '../../libvirtApi/storageVolume.js';
import { VolumeCreateBody } from './storageVolumeCreateBody.jsx';

const _ = cockpit.gettext;

class CreateStorageVolumeModal extends React.Component {
    static contextType = DialogsContext;

    constructor(props) {
        super(props);
        this.state = {
            createInProgress: false,
            dialogError: undefined,
            volumeName: '',
            size: 1,
            unit: units.GiB.name,
            format: getDefaultVolumeFormat(props.storagePool),
        };
        this.dialogErrorSet = this.dialogErrorSet.bind(this);
        this.onCreateClicked = this.onCreateClicked.bind(this);
        this.onValueChanged = this.onValueChanged.bind(this);
        this.validateParams = this.validateParams.bind(this);
    }

    dialogErrorSet(text, detail) {
        this.setState({ dialogError: text, dialogErrorDetail: detail });
    }

    onValueChanged(key, value) {
        this.setState({ [key]: value });
    }

    validateParams() {
        const validationFailed = {};

        if (isEmpty(this.state.volumeName.trim()))
            validationFailed.volumeName = _("Name must not be empty");
        const poolCapacity = parseFloat(convertToUnit(this.props.storagePool.capacity, units.B, this.state.unit));
        if (this.state.size > poolCapacity)
            validationFailed.size = cockpit.format(_("Storage volume size must not exceed the storage pool's capacity ($0 $1)"), poolCapacity.toFixed(2), this.state.unit);

        return validationFailed;
    }

    onCreateClicked() {
        const Dialogs = this.context;
        const validation = this.validateParams();
        if (Object.getOwnPropertyNames(validation).length > 0) {
            this.setState({ createInProgress: false, validate: true });
        } else {
            this.setState({ createInProgress: true, validate: false });

            const { volumeName, format } = this.state;
            const { name, connectionName } = this.props.storagePool;
            const size = convertToUnit(this.state.size, this.state.unit, 'MiB');

            storageVolumeCreate({ connectionName, poolName: name, volName: volumeName, size, format })
                    .then(() => Dialogs.close())
                    .catch(exc => {
                        this.setState({ createInProgress: false });
                        this.dialogErrorSet(_("Volume failed to be created"), exc.message);
                    });
        }
    }

    render() {
        const Dialogs = this.context;
        const idPrefix = `${this.props.idPrefix}-dialog`;
        const validationFailed = this.state.validate ? this.validateParams() : {};

        return (
            <Modal position="top" variant="medium" id={`${idPrefix}-modal`} className='volume-create' isOpen onClose={Dialogs.close}
                   title={_("Create storage volume")}
                   footer={
                       <>
                           {this.state.dialogError && <ModalError dialogError={this.state.dialogError} dialogErrorDetail={this.state.dialogErrorDetail} />}
                           <Button variant="primary" onClick={this.onCreateClicked} isLoading={this.state.createInProgress} isDisabled={this.state.createInProgress}>
                               {_("Create")}
                           </Button>
                           <Button variant='link' className='btn-cancel' onClick={Dialogs.close}>
                               {_("Cancel")}
                           </Button>
                       </>
                   }>
                <Form isHorizontal>
                    <VolumeCreateBody format={this.state.format}
                                      idPrefix={idPrefix}
                                      onValueChanged={this.onValueChanged}
                                      size={this.state.size}
                                      storagePool={this.props.storagePool}
                                      unit={this.state.unit}
                                      validationFailed={validationFailed}
                                      volumeName={this.state.volumeName} />
                </Form>
            </Modal>
        );
    }
}
CreateStorageVolumeModal.propTypes = {
    storagePool: PropTypes.object.isRequired,
};

export class StorageVolumeCreate extends React.Component {
    static contextType = DialogsContext;

    render() {
        const Dialogs = this.context;
        const idPrefix = `${this.props.storagePool.name}-${this.props.storagePool.connectionName}-create-volume`;
        const poolTypesNotSupportingVolumeCreation = ['iscsi', 'iscsi-direct', 'gluster', 'mpath'];

        const createButton = () => {
            if (!poolTypesNotSupportingVolumeCreation.includes(this.props.storagePool.type) && this.props.storagePool.active) {
                return (
                    <Button id={`${idPrefix}-button`}
                            variant='secondary'
                            onClick={() => Dialogs.show(<CreateStorageVolumeModal idPrefix="create-volume"
                                                                                  storagePool={this.props.storagePool} />)}>
                        {_("Create volume")}
                    </Button>
                );
            } else {
                return (
                    <Tooltip id='create-tooltip'
                             content={this.props.storagePool.active ? _("Pool type doesn't support volume creation") : _("Pool needs to be active to create volume")}>
                        <span>
                            <Button id={`${idPrefix}-button`}
                                    variant='secondary'
                                    isDisabled>
                                {_("Create volume")}
                            </Button>
                        </span>
                    </Tooltip>
                );
            }
        };

        return createButton();
    }
}

StorageVolumeCreate.propTypes = {
    storagePool: PropTypes.object.isRequired,
};
