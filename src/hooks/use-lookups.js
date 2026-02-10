import { useQuery } from '@tanstack/react-query'
import * as lookupsApi from '@/api/lookups'

function toMap(arr, keyField) {
  return new Map(arr.map((item) => [item[keyField], item]))
}

export function useLookups() {
  const { data: units = [] } = useQuery({
    queryKey: ['lookups', 'units'],
    queryFn: lookupsApi.getUnits,
    staleTime: Infinity,
  })
  const { data: facilities = [] } = useQuery({
    queryKey: ['lookups', 'facilities'],
    queryFn: lookupsApi.getFacilities,
    staleTime: Infinity,
  })
  const { data: runStatuses = [] } = useQuery({
    queryKey: ['lookups', 'run-statuses'],
    queryFn: lookupsApi.getRunStatuses,
    staleTime: Infinity,
  })
  const { data: salesChannels = [] } = useQuery({
    queryKey: ['lookups', 'sales-channels'],
    queryFn: lookupsApi.getSalesChannels,
    staleTime: Infinity,
  })
  const { data: recipeCategories = [] } = useQuery({
    queryKey: ['lookups', 'recipe-categories'],
    queryFn: lookupsApi.getRecipeCategories,
    staleTime: Infinity,
  })
  const { data: productCategories = [] } = useQuery({
    queryKey: ['lookups', 'product-categories'],
    queryFn: lookupsApi.getProductCategories,
    staleTime: Infinity,
  })
  const { data: productTypes = [] } = useQuery({
    queryKey: ['lookups', 'product-types'],
    queryFn: lookupsApi.getProductTypes,
    staleTime: Infinity,
  })
  const { data: qualityMetricTypes = [] } = useQuery({
    queryKey: ['lookups', 'quality-metric-types'],
    queryFn: lookupsApi.getQualityMetricTypes,
    staleTime: Infinity,
  })

  return {
    units,
    facilities,
    runStatuses,
    salesChannels,
    recipeCategories,
    productCategories,
    productTypes,
    qualityMetricTypes,
    unitsMap: toMap(units, 'unit_id'),
    facilitiesMap: toMap(facilities, 'facility_id'),
    runStatusesMap: toMap(runStatuses, 'run_status_id'),
    salesChannelsMap: toMap(salesChannels, 'sales_channel_id'),
    recipeCategoriesMap: toMap(recipeCategories, 'recipe_category_id'),
    productCategoriesMap: toMap(productCategories, 'product_category_id'),
    productTypesMap: toMap(productTypes, 'product_type_id'),
    qualityMetricTypesMap: toMap(qualityMetricTypes, 'quality_metric_type_id'),
  }
}
