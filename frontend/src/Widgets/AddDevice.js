import React from 'react';
import { Button, message, Modal, Form, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';
import axios from 'axios';

/**
 * AddDevice widget for creating new device records
 * @returns {JSX.Element} Add device button
 */
const AddDevice = () => {
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [form] = Form.useForm();

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      // Prepare the payload
      const payload = {
        ...values,
        data: {},
        lat: 0.0,   // Explicit float for PostgreSQL compatibility
        lon: 0.0,   // Explicit float for PostgreSQL compatibility
        address: values.address || null
      };

      // Make POST request
      const response = await axios.post('http://localhost:8000/device/', payload);

      if (response.status === 200 || response.status === 201) {
        message.success('Device created successfully');
        setIsModalVisible(false);
        form.resetFields();
      }
    } catch (error) {
      console.error('Error creating device:', error);
      message.error('Failed to create device');
    }
  };

  return (
    <>
      <Button
        icon={<PlusOutlined />}
        onClick={showModal}
        style={{ minWidth: '40px', width: '40px', height: '40px', padding: 0 }}
        title="Add new device"
      />

      <Modal
        title="Add New Device"
        open={isModalVisible}
        onCancel={handleCancel}
        onOk={form.submit}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Device Name"
            rules={[{ required: true, message: 'Please input device name!' }]}
          >
            <Input placeholder="e.g. MH55A2818" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please input device description!' }]}
          >
            <Input.TextArea placeholder="e.g. My Vehicle" />
          </Form.Item>

          <Form.Item
            name="address"
            label="Address"
          >
            <Input.TextArea placeholder="(Optional) Device location address" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

AddDevice.propTypes = {
  map: PropTypes.object
};

export default AddDevice;
