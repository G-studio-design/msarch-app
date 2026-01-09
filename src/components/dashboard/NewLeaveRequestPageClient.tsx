
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import type { AddLeaveRequestData } from '@/types/leave-request-types';
import { Loader2, CalendarIcon, Send } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { id as IndonesianLocale, enUS as EnglishLocale } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

const defaultDict = getDictionary('en');

const getLeaveTypes = (dict: ReturnType<typeof getDictionary>['leaveRequestPage']['leaveTypes']) => [
  { value: 'Sakit', label: dict.sickLeave },
  { value: 'Cuti Tahunan', label: dict.annualLeave },
  { value: 'Keperluan Pribadi', label: dict.personalLeave },
  { value: 'Cuti Tidak Dibayar', label: dict.unpaidLeave },
  { value: 'Lainnya', label: dict.other },
];

const getLeaveRequestSchema = (dictValidation: ReturnType<typeof getDictionary>['leaveRequestPage']['validation']) => z.object({
  leaveType: z.string({ required_error: dictValidation.leaveTypeRequired }),
  startDate: z.date({ required_error: dictValidation.startDateRequired }),
  endDate: z.date({ required_error: dictValidation.endDateRequired }),
  reason: z.string().min(10, dictValidation.reasonMinLength).max(500, dictValidation.reasonMaxLength),
}).refine(data => {
  if (!data.startDate || !data.endDate) return true; // Pass if dates are not yet selected
  return data.endDate >= data.startDate;
} , {
  message: dictValidation.endDateAfterStartDate,
  path: ['endDate'],
});

export default function NewLeaveRequestPageClient() {
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const [isClient, setIsClient] = React.useState(false);
  const [dict, setDict] = React.useState(defaultDict);
  const [leaveRequestDict, setLeaveRequestDict] = React.useState(defaultDict.leaveRequestPage);
  const [leaveTypes, setLeaveTypes] = React.useState(() => getLeaveTypes(defaultDict.leaveRequestPage.leaveTypes));
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    const newDictData = getDictionary(language);
    setDict(newDictData);
    setLeaveRequestDict(newDictData.leaveRequestPage);
    setLeaveTypes(getLeaveTypes(newDictData.leaveRequestPage.leaveTypes));
  }, [language]);

  const currentLocale = language === 'id' ? IndonesianLocale : EnglishLocale;

  const leaveRequestSchema = React.useMemo(() => getLeaveRequestSchema(leaveRequestDict.validation), [leaveRequestDict.validation]);
  type LeaveRequestFormValues = z.infer<typeof leaveRequestSchema>;

  const form = useForm<LeaveRequestFormValues>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leaveType: undefined,
      startDate: undefined,
      endDate: undefined,
      reason: '',
    },
  });
  
  React.useEffect(() => {
    if (isClient) {
      form.trigger();
    }
  }, [dict, form, isClient]);


  const onSubmit = async (data: LeaveRequestFormValues) => {
    if (!currentUser) {
      toast({ variant: 'destructive', title: leaveRequestDict.toast.errorTitle, description: leaveRequestDict.toast.notLoggedIn });
      return;
    }
    setIsLoading(true);

    const leaveData: AddLeaveRequestData = {
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName || currentUser.username,
      leaveType: data.leaveType,
      startDate: format(data.startDate, 'yyyy-MM-dd'),
      endDate: format(data.endDate, 'yyyy-MM-dd'),
      reason: data.reason,
    };

    try {
      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaveData),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || leaveRequestDict.toast.submissionFailed);
      }
      
      toast({ title: leaveRequestDict.toast.successTitle, description: leaveRequestDict.toast.requestSubmitted });
      form.reset({ // Reset form to initial default values
        leaveType: undefined,
        startDate: undefined,
        endDate: undefined,
        reason: '',
      });
      // router.push('/dashboard/leave-request/history'); // Optionally redirect to history page
    } catch (error: any) {
      console.error('Failed to submit leave request:', error);
      toast({
        variant: 'destructive',
        title: leaveRequestDict.toast.errorTitle,
        description: error.message || leaveRequestDict.toast.submissionFailed,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');
  let numberOfDays = 0;
  if (startDate && endDate && endDate >= startDate) {
    numberOfDays = differenceInDays(endDate, startDate) + 1;
  }

  if (!isClient || !currentUser) {
    return (
      <div className="container mx-auto py-4 px-4 md:px-6">
        <Card>
          <CardHeader><Skeleton className="h-7 w-1/3 mb-2" /><Skeleton className="h-4 w-2/3" /></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 px-4 md:px-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">{leaveRequestDict.title}</CardTitle>
          <CardDescription>{leaveRequestDict.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="leaveType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{leaveRequestDict.formLabels.leaveType}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={leaveRequestDict.formPlaceholders.leaveType} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leaveTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{leaveRequestDict.formLabels.startDate}</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                              disabled={isLoading}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: currentLocale })
                              ) : (
                                <span>{leaveRequestDict.formPlaceholders.startDate}</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < addDays(new Date(), -1) || isLoading} // Cannot select past dates
                            initialFocus
                            locale={currentLocale}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{leaveRequestDict.formLabels.endDate}</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                              disabled={isLoading || !startDate}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: currentLocale })
                              ) : (
                                <span>{leaveRequestDict.formPlaceholders.endDate}</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => (startDate && date < startDate) || isLoading}
                            initialFocus
                            locale={currentLocale}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {numberOfDays > 0 && (
                <p className="text-sm text-muted-foreground">
                  {leaveRequestDict.numberOfDays.replace('{days}', numberOfDays.toString())}
                </p>
              )}

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{leaveRequestDict.formLabels.reason}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={leaveRequestDict.formPlaceholders.reason}
                        className="resize-none"
                        disabled={isLoading}
                        {...field}
                        rows={4}
                      />
                    </FormControl>
                    <FormDescription>{leaveRequestDict.reasonHint}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit" className="accent-teal" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {isLoading ? leaveRequestDict.submittingButton : leaveRequestDict.submitButton}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
