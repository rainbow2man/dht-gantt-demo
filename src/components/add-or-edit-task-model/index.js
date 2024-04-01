import { Modal, Form } from "antd";

export default function AddOrEditTaskModel(props) {
  return (
    <Modal
      open={visible}
      onCancel={handleModalCancel}
      footer={renderFooter()}
      destroyOnClose
      title="新建/编辑任务"
      className="edit-task-modal"
    >
      <Form
        initialValues={curTask}
        onValuesChange={handleFormChange}
        onFinish={handleModalSave}
        //任务data
        ref={formref}
      >
        {renderFormList()}
      </Form>
    </Modal>
  );
}
