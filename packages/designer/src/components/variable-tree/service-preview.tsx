import { PlayCircleOutlined } from '@ant-design/icons';
import { code2value } from '@music163/tango-core';
import { useSandboxQuery } from '@music163/tango-designer';
import { getValue, isNil, logger } from '@music163/tango-helpers';
import { InputCode, JsonView, Panel } from '@music163/tango-ui';
import { Button, Empty } from 'antd';
import { Box } from 'coral-system';
import React, { useState } from 'react';

export interface ServicePreviewProps {
  appContext?: any;
  functionKey?: string;
}

export function ServicePreview({ functionKey }: ServicePreviewProps) {
  const [payload, setPayload] = useState({});
  const [result, setResult] = useState<any>();
  const [error, setError] = useState('');
  const sandbox = useSandboxQuery();
  const appContext = (sandbox.window as any)['tango'];
  return (
    <Box>
      <Panel title="请求参数" bodyProps={{ px: 'l' }}>
        <InputCode
          placeholder={'添加请求参数，对象格式，如 { key: value }'}
          editable
          showLineNumbers
          onChange={(value: string) => {
            const obj = code2value(value); // 转为 object 对象
            setPayload(obj);
          }}
        />
        <Button
          block
          type="primary"
          style={{ margin: '8px 0' }}
          disabled={!appContext}
          onClick={() => {
            if (!appContext || Object.keys(appContext).length === 0) {
              setError('执行上下文未准备好，请关闭面板重试');
              return;
            }
            try {
              const fn = getValue(appContext, functionKey);
              fn(payload).then((data: any) => {
                setError('');
                setResult(data);
              });
            } catch (err) {
              setError('接口调用失败，请检查参数是否正确');
              logger.error(err);
            }
          }}
          icon={<PlayCircleOutlined />}
        >
          预览
        </Button>
      </Panel>
      <Panel title="请求响应" bodyProps={{ px: 'l' }}>
        {error || (result ? <ResponseDataPreview data={result} /> : '点击预览按钮测试接口返回值')}
      </Panel>
    </Box>
  );
}

interface ResponseDataPreviewProps {
  data?: object;
}

function ResponseDataPreview({ data }: ResponseDataPreviewProps) {
  let ret: React.ReactNode;

  if (!isNil(data)) {
    switch (typeof data) {
      case 'object':
        ret = <JsonView src={data as object} />;
        break;
      default:
        ret = String(data);
        break;
    }
  }

  const initialRet = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  return (
    <Box
      className="ResponseDataPreview"
      overflow="auto"
      height="auto"
      minHeight={260}
      marginTop={10}
    >
      {ret || initialRet}
    </Box>
  );
}
