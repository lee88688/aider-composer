import {
  VSCodeButton,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
  VSCodeDivider,
} from '@vscode/webview-ui-toolkit/react';
import { Trash2, Split } from 'lucide-react';
import styled from '@emotion/styled';
import { useFormik } from 'formik';
import { settingMap } from './config';
import useSettingStore, {
  ChatModelSetting,
} from '../../stores/useSettingStore.ts';
import useExtensionStore from '../../stores/useExtensionStore';
import * as Yup from 'yup';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { List, ListItem } from '../../components/list.tsx';

const FormItemContainer = styled.div({
  boxSizing: 'border-box',
  display: 'flex',
  flexFlow: 'column nowrap',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  marginBottom: '10px',

  '& > label': {
    display: 'block',
    color: 'var(--vscode-foreground)',
    cursor: 'pointer',
    fontSize: 'var(--vscode-font-size)',
    lineHeight: 'normal',
    marginBottom: '2px',
  },
});

const ErrorMessage = styled.div({
  color: 'var(--vscode-editorError-foreground)',
  marginTop: '2px',
});

type SettingFormRef = {
  setFormData: (s: ChatModelSetting) => void;
};

const initialValues = {
  name: '',
  provider: 'openai',
  model: '',
  apiKey: '',
  baseUrl: '',
};

const SettingForm = forwardRef<
  SettingFormRef,
  { models: ChatModelSetting[]; onAdd: (s: ChatModelSetting) => void }
>(function SettingForm(props, ref) {
  const models = props.models;

  const schema = useMemo(() => {
    const names = models.map((item) => item.name);
    return Yup.object({
      name: Yup.string()
        .required('Name is required')
        .test('unique', 'Name already exists', function (value) {
          return !names.includes(value);
        }),
      provider: Yup.string().required('Provider is required'),
      model: Yup.string().required('Model is required'),
      apiKey: Yup.string().required('API Key is required'),
      baseUrl: Yup.string().when('provider', {
        is: (provider: string) => settingMap[provider]?.hasBaseUrl,
        then: (schema) => schema.required('Base URL is required'),
        otherwise: (schema) => schema.optional(),
      }),
    });
  }, [models]);

  const formik = useFormik({
    initialValues,
    validationSchema: schema,
    onSubmit: async (values) => {
      props.onAdd(values);
      // formik.setValues(initialValues);
      formik.resetForm();
    },
  });

  useImperativeHandle(ref, () => ({
    setFormData: (s: ChatModelSetting) => {
      formik.setValues(s);
    },
  }));

  const providerSetting = settingMap[formik.values.provider];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <FormItemContainer>
        <label>Name</label>
        <VSCodeTextField
          value={formik.values.name}
          onChange={(e) => {
            formik.setFieldTouched('name');
            formik.setFieldValue('name', (e.target as HTMLInputElement).value);
          }}
        />
        {formik.touched.name && formik.errors.name && (
          <ErrorMessage>{formik.errors.name}</ErrorMessage>
        )}
      </FormItemContainer>

      <FormItemContainer>
        <label>Provider</label>
        <VSCodeDropdown
          value={formik.values.provider}
          onChange={(e) => {
            const newProvider = (e.target as HTMLSelectElement).value;
            formik.setFieldTouched('provider');
            formik.setFieldValue('provider', newProvider);
            formik.setFieldValue('model', '');
            formik.setFieldValue('apiKey', '');
            formik.setFieldValue('baseUrl', '');
          }}
        >
          <VSCodeOption value="openai">OpenAI</VSCodeOption>
          <VSCodeOption value="anthropic">Anthropic</VSCodeOption>
          <VSCodeOption value="deepseek">DeepSeek</VSCodeOption>
          <VSCodeOption value="ollama">Ollama</VSCodeOption>
          <VSCodeOption value="openrouter">OpenRouter</VSCodeOption>
          <VSCodeOption value="openai_compatible">
            OpenAI Compatible
          </VSCodeOption>
        </VSCodeDropdown>
      </FormItemContainer>

      <FormItemContainer>
        <label>Model</label>
        {Array.isArray(providerSetting.model) ? (
          <VSCodeDropdown
            value={formik.values.model}
            onChange={(e) => {
              formik.setFieldTouched('model');
              formik.setFieldValue(
                'model',
                (e.target as HTMLSelectElement).value,
              );
            }}
          >
            {providerSetting.model.map((item) => (
              <VSCodeOption key={item.value} value={item.value}>
                {item.label}
              </VSCodeOption>
            ))}
          </VSCodeDropdown>
        ) : (
          <VSCodeTextField
            value={formik.values.model}
            onChange={(e) => {
              formik.setFieldTouched('model');
              formik.setFieldValue(
                'model',
                (e.target as HTMLInputElement).value,
              );
            }}
          />
        )}
        {formik.touched.model && formik.errors.model && (
          <ErrorMessage>{formik.errors.model}</ErrorMessage>
        )}
      </FormItemContainer>

      <FormItemContainer>
        <label>API Key</label>
        <VSCodeTextField
          type="password"
          value={formik.values.apiKey}
          onChange={(e) => {
            formik.setFieldTouched('apiKey');
            formik.setFieldValue(
              'apiKey',
              (e.target as HTMLInputElement).value,
            );
          }}
        />
        {formik.touched.apiKey && formik.errors.apiKey && (
          <ErrorMessage>{formik.errors.apiKey}</ErrorMessage>
        )}
      </FormItemContainer>

      {providerSetting.hasBaseUrl && (
        <FormItemContainer>
          <label>Base URL</label>
          <VSCodeTextField
            value={formik.values.baseUrl}
            onChange={(e) => {
              formik.setFieldTouched('baseUrl');
              formik.setFieldValue(
                'baseUrl',
                (e.target as HTMLInputElement).value,
              );
            }}
          />
          {formik.touched.baseUrl && formik.errors.baseUrl && (
            <ErrorMessage>{formik.errors.baseUrl}</ErrorMessage>
          )}
        </FormItemContainer>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <VSCodeButton onClick={() => formik.handleSubmit()}>Add</VSCodeButton>
        <VSCodeButton
          appearance="secondary"
          onClick={() => {
            // formik.setValues(initialValues);
            formik.resetForm();
          }}
        >
          Reset
        </VSCodeButton>
      </div>
    </div>
  );
});

export default function Setting() {
  const models = useSettingStore((state) => state.models);
  const current = useSettingStore((state) => state.current);

  const setSetting = useSettingStore((state) => state.setSetting);
  const setViewType = useExtensionStore((state) => state.setViewType);

  const [currentSetting, setCurrentSetting] = useState(current);
  const [currentModels, setCurrentModels] = useState(models);

  const ref = useRef<SettingFormRef>(null);

  useEffect(() => {
    if (!currentModels.find((item) => item.name === currentSetting)) {
      setCurrentSetting(currentModels[0]?.name ?? '');
    }
  }, [currentModels, currentSetting]);

  return (
    <div style={{ padding: '12px' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1
          style={{
            margin: '10px 0',
            fontSize: 'calc(var(--vscode-font-size) * 1.5)',
          }}
        >
          Settings
        </h1>
        <VSCodeButton
          onClick={async () => {
            await setSetting(currentSetting, currentModels);
            setViewType('chat');
          }}
        >
          Save
        </VSCodeButton>
      </div>
      <FormItemContainer>
        <label>Current Setting</label>
        <VSCodeDropdown
          value={currentSetting}
          onChange={(e) => {
            setCurrentSetting((e.target as HTMLSelectElement).value);
          }}
        >
          {currentModels.map((item) => (
            <VSCodeOption key={item.name} value={item.name}>
              {item.name}
            </VSCodeOption>
          ))}
        </VSCodeDropdown>
        <ErrorMessage>
          {!currentSetting && 'Please select a setting'}
        </ErrorMessage>
      </FormItemContainer>
      <VSCodeDivider />
      <List>
        {currentModels.map((item) => {
          return (
            <ListItem>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>{item.name}</div>
                <div>
                  <VSCodeButton
                    title="Fork this setting"
                    appearance="icon"
                    style={{ marginRight: '4px' }}
                    onClick={() => ref.current?.setFormData(item)}
                  >
                    <Split />
                  </VSCodeButton>
                  <VSCodeButton
                    title="Delete this setting"
                    appearance="icon"
                    onClick={() => {
                      setCurrentModels(
                        currentModels.filter((i) => i.name !== item.name),
                      );
                    }}
                  >
                    <Trash2 />
                  </VSCodeButton>
                </div>
              </div>
            </ListItem>
          );
        })}
      </List>
      <VSCodeDivider />
      <SettingForm
        ref={ref}
        onAdd={(s) => setCurrentModels((p) => [...p, s])}
        models={currentModels}
      />
    </div>
  );
}
