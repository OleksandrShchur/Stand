import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Container, Stack, TextField, Typography } from '@mui/material';
import BrandHeader from '../../components/BrandHeader';
import MainContent from '../../components/MainContent';
import { publicApi } from '../../api/publicApi';
import { ApiError } from '../../api/client';
import { pagePadding, sectionGap } from '../../layoutSpacing';
import { surfaceShadow } from '../../surfaceStyles';
import { FEEDBACK_MAX_LENGTH, feedbackValidationError } from './feedbackValidation';

export default function FeedbackPage() {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const submittingRef = useRef(false);
    const [comment, setComment] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const back = () => { if (!submittingRef.current) navigate('/'); };
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (submittingRef.current) return;
        const error = feedbackValidationError(comment);
        setValidationError(error);
        if (error) {
            inputRef.current?.focus();
            return;
        }
        submittingRef.current = true;
        setSubmitting(true);
        setSubmitError(null);
        try {
            await publicApi.submitFeedback(comment);
            navigate('/', { replace: true, state: { feedbackSubmitted: true } });
        } catch (error) {
            setSubmitError(error instanceof ApiError ? error.message : 'Не вдалося надіслати відгук. Спробуйте ще раз.');
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <BrandHeader title="Відгук" onHome={back} />
            <Container component={MainContent} className="content-enter" maxWidth="sm" sx={{ ...pagePadding, pt: 3, pb: 'calc(120px + env(safe-area-inset-bottom, 0px))' }}>
                <Stack component="form" id="feedback-form" noValidate onSubmit={submit} spacing={sectionGap}>
                    <Typography component="h1" variant="h5">Поділіться враженнями</Typography>
                    <Typography color="text.secondary">Напишіть, що вам сподобалося або що варто покращити.</Typography>
                    <TextField
                        id="feedback-comment"
                        inputRef={inputRef}
                        label="Ваш відгук"
                        multiline
                        minRows={8}
                        maxRows={16}
                        fullWidth
                        value={comment}
                        disabled={submitting}
                        onChange={(event) => {
                            setComment(event.target.value);
                            setValidationError(null);
                            setSubmitError(null);
                        }}
                        error={Boolean(validationError)}
                        helperText={`${validationError ? `${validationError} ` : ''}${comment.length}/${FEEDBACK_MAX_LENGTH} символів`}
                        slotProps={{
                            htmlInput: { maxLength: FEEDBACK_MAX_LENGTH, 'aria-describedby': 'feedback-privacy feedback-comment-helper-text', style: { fontSize: 16 } },
                            formHelperText: { 'aria-live': 'polite' },
                        }}
                    />
                    {submitError && <Alert severity="error">{submitError}</Alert>}
                </Stack>
            </Container>
            <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider', boxShadow: surfaceShadow, borderRadius: '16px 16px 0 0', pb: 'env(safe-area-inset-bottom, 0px)' }}>
                <Container maxWidth="sm" sx={{ ...pagePadding, py: 2 }}>
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="large" disabled={submitting} onClick={back} sx={{ minHeight: 56, flex: '1 1 0', minWidth: 0 }}>Назад</Button>
                        <Button type="submit" form="feedback-form" variant="contained" size="large" loading={submitting} disabled={submitting || Boolean(feedbackValidationError(comment))} sx={{ minHeight: 56, flex: '1 1 0', minWidth: 0 }}>Надіслати</Button>
                    </Stack>
                </Container>
            </Box>
        </Box>
    );
}
