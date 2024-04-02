import { Modal, Form, Button } from "antd";
import { gantt } from "dhtmlx-gantt";
import { originColumns } from "../../config";
import ModalFormItem from "../modal-form-item";
import React, { useRef, useState } from "react";
import dayjs from "dayjs";
import { delayChildStartDate, generateNumber } from "../../utils";
import BigNumber from "bignumber.js";

export default function AddOrEditTaskModel(props) {
  const [curTask, setCurTask] = useState({});
  const [broIndex, setBroIndex] = useState(0);
  const [maxCount, setMaxCount] = useState();
  const [addType, setAddType] = useState("");

  const formref = useRef();
  const _treeMap = useRef({}); // 记录记录树的父级包含的子级顺序的映射
  const _targetMap = useRef({});
  const _sourceMap = useRef({});

  //表单内 grid栅栏 的配置
  const formItemLayout = {
    labelCol: {
      span: 6,
    },
    wrapperCol: {
      span: 16,
    },
  };

  // 渲染 模态框底部
  function renderFooter() {
    return (
      <div className="task-modal-footer">
        <div className="footer-left">
          {/* <Popconfirm
            title='任务将被永久删除，确认吗？'
            onConfirm={() => { handleModalDelete() }}
          >
            <Button type="danger">删除</Button>
          </Popconfirm> */}
        </div>
        <div className="footer-right">
          <Button onClick={handleModalCancel}>取消</Button>
          <Button type="primary" onClick={handleModalSubmit}>
            确定
          </Button>
        </div>
      </div>
    );
  }

  // 取消编辑或新建 任务
  function handleModalCancel() {
    if (curTask.$new) {
      gantt.deleteTask(curTask.id);
    }
    props.setVisible(false);
    setMaxCount();
    setCurTask({});
  }

  // 任务模态框 表单值一旦更新，修改开始结束时间需要同步修改持续时间，修改进度需要修改状态
  function handleFormChange(value, allValue) {
    console.log("打开模态框触发的表单值更新");
    // console.log(value, allValue, 'value, allValue')
    // 如果 开始日期 或 持续时间 的值变动了，需要更新 结束日期
    if (value.start_date || value.duration) {
      // eslint-disable-next-line camelcase
      const { start_date } = allValue;
      let { duration } = allValue;

      // 如果这次更新的时 start_date, 需要重新计算 duration 的上限
      if (value.start_date) {
        const durationLimit = handleCalcMax(allValue);

        // 当 duration 上限存在 并且 duration 大于上限时， duration 等于上线
        if (durationLimit && duration > durationLimit) {
          duration = durationLimit;
        }

        // 更新 duration
        formref.current.setFieldsValue({
          duration,
        });
      }

      const endDate = gantt.calculateEndDate(new Date(start_date), duration);
      endDate.setDate(endDate.getDate() - 1); // 联动更新完 结束日期要减一

      formref.current.setFieldsValue({
        end_date: endDate,
      });
    } else if (value.progress) {
      // 进度和状态更改了，都要去修改另一项
      const status = value.progress === 1 ? "finish" : "continue";
      formref.current.setFieldsValue({
        task_status: status,
      });
    } else if (value.task_status) {
      const progress = value.task_status === "finish" ? 1 : 0;
      formref.current.setFieldsValue({
        progress,
      });
    } else if (value.parent) {
      if (value.parent === 0) {
        setMaxCount();
      } else {
        const parentTask = gantt.getTask(value.parent);
        const parentEndDate = new Date(parentTask.end_date);
        parentEndDate.setDate(parentEndDate.getDate() - 1);
        const tempTask = { ...curTask, ...allValue };

        // 如果 任务 不在父任务的范围内
        if (
          !(
            allValue.end_date <= parentEndDate &&
            allValue.start_date >= parentTask.start_date
          )
        ) {
          // 如果 任务原本的持续时间 大于 父任务的持续时间，任务的持续时间改为与父任务相等
          if (tempTask.duration > parentTask.duration) {
            tempTask.duration = parentTask.duration;
          }

          // 获取父级的 startDate 并计算 任务修改到父任务日期范围内后的 endDate
          const startDate = parentTask.start_date;
          const endDate = gantt.calculateEndDate(startDate, tempTask.duration);
          endDate.setDate(endDate.getDate() - 1);

          // 重新更新 开始和结束日期
          tempTask.start_date = startDate;
          tempTask.end_date = endDate;

          formref.current.setFieldsValue(tempTask);
        }

        handleCalcMax(tempTask);
      }
    }
  }

  //PASS 计算 任务持续时间最大值 和根任务的完成时间挂钩
  function handleCalcMax(task) {
    console.log("表格更新，触发最大持续时间更新");
    const record = { ...(task || curTask) };

    // 如果该任务为根任务，则不需要有最大值的限制
    if (!record.parent) {
      setMaxCount();
      return undefined;
    }

    // 获取父任务的结束日期
    const parentTask = gantt.getTask(record.parent);
    const parentEndDate = new Date(parentTask.end_date);

    // 计算出 过滤了周末的 持续时间，即为 持续时间的最大值
    const startDate = new Date(record.start_date);
    const diffDay = gantt.calculateDuration(startDate, parentEndDate);

    setMaxCount(Number(diffDay));
    return Number(diffDay);
  }
  // 新增 修改 任务保存
  function handleModalSave(formValue) {
    // const formValue = formref.current.getFieldsValue();
    // console.log(formValue, 'formValue')

    // 保存的时候将 父级处理回 字符串，这样才能重新映射回 甘特图组件上
    // formValue.parent = formValue.parent.value;

    const isNewFlag = curTask.isNew || curTask.$new;

    const newTask = {
      ...curTask,
      ...formValue,
      isNew: isNewFlag,
      isEdit: !isNewFlag,
    };

    // 当有 dayjs 对象时 转为 date 对象
    Object.keys(newTask).forEach((key) => {
      if (dayjs.isDayjs(newTask[key])) {
        newTask[key] = newTask[key].toDate();
        // newTask[map[key]] = newTask[key];
        // setDynFieldValue(newTask, key, newTask[key].toDate());
      }
    });

    // 获取任务的原始父级
    const originParent = curTask.parent;
    const { parent } = newTask;

    // 计算 tindex 如果为新增本级，那么就是之前存的 broIndex, 如果是添加子级，直接用子级长度作为 index
    const parentLength = _treeMap.current[parent]?.length;
    const tindex = parentLength
      ? addType === "bro"
        ? broIndex
        : parentLength
      : 0;

    const endDate = new Date(newTask.end_date);
    endDate.setDate(endDate.getDate() + 1); // 确认任务时 结束日期加一天
    newTask.end_date = endDate;
    // setDynFieldValue(newTask, 'end_date', endDate);

    // 如果保存的任务 配置了前置任务
    if (newTask.pre_task) {
      const { id, pre_task: preTask } = newTask;
      // 设置 link
      const tempLink = {
        id: `${preTask}-${id}`,
        source: preTask,
        target: id,
        type: "0",
      };

      // 如果 targetMap 中不存在，直接 添加 link
      if (!_targetMap.current[id]) {
        _targetMap.current[id] = tempLink;
        _sourceMap.current[preTask] = tempLink;
        gantt.addLink(tempLink);
      } else {
        // 如果 targetMap 中存在
        const preLink = _targetMap.current[id];

        // 看一下存的 source 是否和 当前前置任务一致，不一致的时候
        if (preLink.source !== preTask) {
          gantt.deleteLink(preLink.id);
          _targetMap.current[id] = tempLink;
          _sourceMap.current[preTask] = tempLink;
          gantt.addLink(tempLink);
          newTask.pre_task = preTask;
          // setDynFieldValue(newTask, 'pre_task', preTask);
        }
      }
    } else {
      // 如果保存的任务 没有配置前置任务
      const { id, pre_task: preTask } = newTask;
      const preLink = _targetMap.current[id];

      // 查看是否存在于  targetMap 中，如果存在，即这次为清空前置任务，需要删掉 link
      if (_targetMap.current[id]) {
        gantt.deleteLink(preLink.id);
        delete _targetMap.current[id];
        delete _sourceMap.current[preTask];
      }
    }

    // 如果存在 $new 则代表是新建的
    if (newTask.$new) {
      delete newTask.$new;
      // 先添加任务，在重排
      gantt.addTask(newTask, parent, tindex);
      newUpdateSortCode(newTask.id, parent, tindex, newTask);
    } else {
      if (originParent !== parent) {
        newUpdateSortCode(newTask.id, parent, tindex, undefined, newTask);
      } else {
        gantt.updateTask(newTask.id, newTask);
        updateTreeMapItem(newTask.parent, newTask.id, newTask);
      }
    }

    gantt.eachTask((child) => {
      // 限制 任务子级的 开始日期和结束日期
      controlChildLimit(child, newTask, newTask.start_date);
    }, newTask.id);

    props.setVisible(false);
    setMaxCount();
    setAddType("");
    setBroIndex(0);
    gantt.resetLayout(); // 重置表格 布局，即新建任务的时候，可以看到新建的任务
  }

  // 新版  重排 任务用于排序的 code（隐式code 不重排，确保同级 code 唯一，然后显示code 只在前端渲染，给后端只传更改的数据）
  function newUpdateSortCode(id, parent, tindex, newTask, editTask) {
    console.log("任务被移动了。触发onrender事件");
    // 获取 全局保存的树状的 数据
    const tempTreeMap = _treeMap.current;

    // 获取它的兄弟数组
    let broList = tempTreeMap[parent] || [];
    broList = broList.sort((a, b) => {
      return a.code - b.code;
    });

    // 通过 树状数据 处理出 人物列表
    const taskList = Object.values(tempTreeMap).reduce((prev, next) => {
      return prev.concat(next);
    }, []);

    // 遍历任务列表，找到正在移动的任务 的原始数据
    let moveTask = newTask || {};
    taskList.forEach((item) => {
      if (`${item.id}` === `${id}`) {
        // eslint-disable-next-line camelcase
        // const { start_date, end_date, duration } = editTask;
        const { parent: originParent } = item;

        const tempTask = { ...item, ...editTask };
        // setDynFieldValue(tempTask, 'start_date', start_date);
        // setDynFieldValue(tempTask, 'end_date', end_date);
        // setDynFieldValue(tempTask, 'duration', duration);
        // setDynFieldValue(tempTask, 'parent', originParent);
        tempTask.parent = originParent;

        moveTask = tempTask;
      }
    });

    // 找到该任务的原始父级 和 原始的兄弟数组
    const originParent = newTask ? null : moveTask.parent;
    const originBroList = (tempTreeMap[originParent] || []).sort((a, b) => {
      return a.code - b.code;
    });

    // 并找出 移动任务在 原始兄弟数组中的 Index
    let originIndex = 0;
    originBroList.forEach((item, index) => {
      if (item.id === moveTask.id) {
        originIndex = index;
      }
    });

    // 判断 拖拽任务 拖拽前的父级 是否与 拖拽后的父级一直，并且 originIndex 是否小于 当前index
    const indexFlag = originParent === parent && originIndex < tindex;
    // 如果 indexFlag 为 true 的话 tindex 要比往常多 1，因为是同级拖拽，前面的数据一道后面时，index 不比平常多 1的话，会导致数据取的不对
    const beforeIndex = indexFlag ? tindex : tindex - 1;
    const afterIndex = indexFlag ? tindex + 1 : tindex;

    // 如果 拖拽到最后一个位置
    if (
      tindex > 0 &&
      tindex === (originParent === parent ? broList.length - 1 : broList.length)
    ) {
      console.log("插入最后");
      // 获取之前最后一个位置的 task
      const beforeTask = broList[beforeIndex];

      // 如果该 task 就是 MoveTask 则 return，会出现这个状况是因为 taskMove 会执行两次，第二次执行会让 code 混乱
      if (beforeTask.id === moveTask.id) return;

      // 获取 需要切割的 code
      // codeArr 会将 code 根据小数点切割成数组
      let codeArr = "";
      if (beforeTask.code) {
        codeArr = beforeTask.code.toString().split(".");
      } else {
        codeArr = [];
      }

      // 根据 code 小数点后的数量确定 小数精度
      const precision = codeArr[1]?.length || 0;
      // 根据小数精度，确定需要增加的 Num 量
      const preNum = generateNumber(precision);

      // 让 beforeCode 与 preNum 相加 即为 移动任务新的 code
      const moveCode = Number(
        BigNumber(beforeTask.code).plus(preNum).toString()
      );
      moveTask.code = moveCode;
    } else if (tindex > 0) {
      console.log("插入中间");
      // 如果不是在最后，并且 tindex > 0，即为在两个值之间插入了
      // 找到插入位置前一个任务 和 后一个任务
      const beforeTask = broList[beforeIndex];
      const afterTask = broList[afterIndex];

      // 如果后一个任务 就是 MoveTask 则 return，会出现这个状况是因为 taskMove 会执行两次，第二次执行会让 code 混乱
      if (afterTask.id === moveTask.id) return;

      // 分别获取 Before 和 after 任务code 切割后的文本
      const beforeCodeArr = beforeTask.code.toString().split(".");
      const afterCodeArr = afterTask.code.toString().split(".");

      // 获取 before 和 after code 的精度，去最小的，最精细的
      const beforePre = beforeCodeArr[1]?.length || 1;
      const afterPre = afterCodeArr[1]?.length || 1;
      let precision = Math.max(beforePre, afterPre);

      // 根据小数精度，确定需要增加的 Num 量
      let preNum = generateNumber(precision);
      let moveCode = 0;
      // 如果 beforeCode + preNum === afterCode 时，需要提升精度 1 级精度
      if (
        BigNumber(preNum).plus(beforeTask.code).toString() ===
        `${afterTask.code}`
      ) {
        precision += 1;
        preNum = generateNumber(precision);
      }

      // 让 beforeCode 与 preNum 相加 即为 移动任务新的 code
      moveCode = Number(BigNumber(preNum).plus(beforeTask.code).toString());
      moveTask.code = moveCode;
    } else {
      console.log("插入开头");
      // 以上两个都不满足的话，即为插入到第一个的位置
      // 查找之前在 第一个的任务，如果找不到，即为之前没有，默认为一个空数组
      const afterTask = broList[afterIndex] || {};

      // 如果后一个任务 就是 MoveTask 则 return，会出现这个状况是因为 taskMove 会执行两次，第二次执行会让 code 混乱
      if (afterTask.id === moveTask.id) return;

      // 获取 需要切割的 code
      // codeArr 会将 code 根据小数点切割成数组
      let codeArr = "";
      if (afterTask.code) {
        codeArr = afterTask.code.toString().split(".");
      } else {
        codeArr = [];
      }

      // 根据 code 小数点后的数量确定 小数精度
      const precision = codeArr[1]?.length || 0;
      // 根据小数精度，确定需要增加的 Num 量
      const preNum = generateNumber(precision + 1);
      const moveCode = Number(preNum.toFixed(precision + 1));
      moveTask.code = moveCode;
      // setDynFieldValue(moveTask, 'code', moveCode);

      // 如果之前没有 broList，需要新建一个，并且更新到 tempTreeMap 中，用于之后添加
      if (!broList.length) {
        tempTreeMap[parent] = [];
        broList = tempTreeMap[parent];
      }
    }

    // 修改 移动任务的 parent 为 当前插入的 parent，并且编辑标识改为 true
    moveTask.parent = parent;
    // setDynFieldValue(moveTask, 'parent', parent);

    // 如果 存在 父级
    if (parent && parent !== 0) {
      const parentTask = gantt.getTask(parent);

      // 当 移动的任务的持续时间 小于或等于 父级的持续时间
      if (moveTask.duration <= parentTask.duration) {
        // 如果 移动任务的开始日期 大于 父任务的开始日期 并且 小于父任务的结束日期
        // 需要计算其 与 父任务开始日期的差值
        if (
          moveTask.start_date > parentTask.start_date &&
          moveTask.start_date < parentTask.end_date
        ) {
          const offsetDur = gantt.calculateDuration(
            parentTask.start_date,
            moveTask.start_date
          );
          moveTask.offsetDur = offsetDur;
        } else {
          moveTask.offsetDur = 0;
        }

        // 限制任务的 开始结束日期
        controlChildLimit(moveTask, parentTask, parentTask.start_date, true);
      } else {
        // 当 移动的任务的持续时间 大于 父级的持续时间
        // 任务时间变成和父任务一致
        // eslint-disable-next-line camelcase
        const { start_date, end_date, duration } = parentTask;
        moveTask.start_date = start_date;
        moveTask.end_date = end_date;
        moveTask.duration = duration;
        // setDynFieldValue(moveTask, 'start_date', start_date);
        // setDynFieldValue(moveTask, 'end_date', end_date);
        // setDynFieldValue(moveTask, 'duration', duration);
      }
    }

    if (!(moveTask.isNew || moveTask.$new)) moveTask.isEdit = true;

    // 将该任务 从原本存在的数组中 删除
    if (tempTreeMap[originParent])
      tempTreeMap[originParent].splice(originIndex, 1);

    // 在 要插入的数组中添加
    broList.splice(tindex, 0, moveTask);
    _treeMap.current = tempTreeMap;

    // 更新所有任务 以及 生成新的 codeMap
    updateCodeMapAndTask(tempTreeMap);
  }

  // 更新 treeMap 里的数据
  function updateTreeMapItem(parentId, id, task) {
    const list = _treeMap.current[parentId];
    const index = list.findIndex((item) => item.id === id);

    if (index >= 0) {
      list[index] = { ...list[index], ...task };
    }
  }

  // 更新 codeMap 以及 重排任务的显示序号
  function updateCodeMapAndTask(treeMap) {
    const newList = [];

    // 因为在 treeMap 中没有最外层的数据，所以这里初始化一个最外层的对象
    const tempCodeMap = {
      0: {
        code: null,
        count: treeMap[0]?.length,
      },
    };

    // 处理 任务成 codeMap, 并获得 更新过 code 的任务
    formatCodeMap(treeMap[0], null, treeMap, tempCodeMap, newList);
    codeMap.current = tempCodeMap;

    // 批量更新任务
    gantt.batchUpdate(() => {
      newList.forEach((item) => {
        gantt.updateTask(item.id, item);
      });
    });
    gantt.resetLayout();
  }

  // 渲染 模态框的 表单列表
  function renderFormList() {
    const list = [];

    //循环config.js中的originColumns，渲染单行表单项
    originColumns.forEach((item) => {
      const { name, label, type: itemType, originField, required } = item;

      const component = (
        <Form.Item
          key={item.name}
          {...formItemLayout}
          name={originField || name}
          label={label}
          rules={
            required
              ? [{ required: true, message: `${label}字段为必输项` }]
              : null
          }
        >
          {/*渲染表单项内容 */}
          {renderFormItem(item)}
        </Form.Item>
      );

      if (itemType) {
        list.push(component);
      }
    });

    return list;
  }

  // PASS 渲染 表单项当行
  function renderFormItem(item) {
    return (
      //进入组件选择器
      <ModalFormItem
        gantt={gantt}
        curTask={curTask}
        formref={formref}
        //父组件的结束时间-开始时间 即为最大的持续时间
        durationMax={maxCount}
        // item.type决定了当前显示的是哪个组件
        config={item}
        afterBlur={() => {}}
        disabled={item.type === "codingRule" || item.name === "showCode"}
        // disabledDate={disabledDate}
        // fieldMap={fieldMap}
      />
    );
  }

  // 保存 走 表单校验
  function handleModalSubmit() {
    formref.current.submit();
  }

  // 限制 任务子级的 开始日期和结束日期
  function controlChildLimit(child, task, parentStart, noChangeFlag) {
    // 如果子级的开始时间到 节假日了，也需要往后延迟到工作日
    // 除此之外 还要和父级保持 相等的工作日天数差值
    const childStartDate = delayChildStartDate(parentStart, child.offsetDur);

    // 更新 子级任务的数据
    child.start_date = childStartDate;
    child.end_date = gantt.calculateEndDate(childStartDate, child.duration);

    // 限制子级 不超过父级的 开始日期 和 结束日期
    // if (task && +task.start_date > +child.start_date) {
    //   limitMoveRight(child, task);
    // }
    // if (task && +task.end_date < +child.end_date) {
    //   limitMoveLeft(child, task);
    // }

    // 更新任务
    child.isEdit = true;

    // 如果传了 这个参数 就不去实时更新
    // 主要是在 模态框里确定后使用的，在那里如果提前更新的话 会导致最后更新数据出现错行的问题
    if (!noChangeFlag) {
      gantt.updateTask(child.id, child);
      updateTreeMapItem(child.parent, child.id, child);
    }
  }

  //PASS 处理 任务成 codeMap（如果新增或者修改了 更新code/showcode）
  function formatCodeMap(
    items,
    parentCode,
    tree,
    tempCodeMap,
    newList,
    level = 0
  ) {
    if (!items) return;
    // 将 子代任务进行排序
    items.sort((a, b) => {
      return a.code - b.code;
    });

    // 遍历排序好的 子代，然后赋编号code
    items.forEach((item, index) => {
      const { id } = item;
      //拼接新的showcode  如果有 父级code，生成新的 code 为 父级code.父级子任务数量 比如：1.2 2.4
      const code = parentCode
        ? `${parentCode}.${index + 1}`
        : String(index + 1);
      item.showCode = code;
      // 增加这三行 带$的属性 是为了 让甘特图新增完任务重排的时候顺序不乱
      item.$index = index;
      item.$level = level;
      if (broIndex) item.$rendered_parent = item.parent;

      // 将更新了 code 的 item 传出去更新
      newList.push(item);

      // 如果 tree[item.id] 存在，即为 该任务有子代，继续遍历
      if (tree[item.id]) {
        tempCodeMap[id] = {
          count: tree[item.id].length,
          code,
        };

        formatCodeMap(
          tree[item.id],
          code,
          tree,
          tempCodeMap,
          newList,
          level + 1
        );
      } else {
        tempCodeMap[id] = {
          count: 0,
          code,
        };
      }
    });
  }

  return (
    <Modal
      open={props.visible}
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
